import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
}

// In-memory sliding window rate limiter (swappable for Redis later)
const rateLimitMap = new Map<string, { timestamps: number[] }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const limitWindowMs = 60 * 1000 // 1 minute
  const maxRequestsPerMin = 10
  
  const record = rateLimitMap.get(userId) ?? { timestamps: [] }
  // Filter out timestamps outside the window
  const activeTimestamps = record.timestamps.filter(t => now - t < limitWindowMs)
  
  if (activeTimestamps.length >= maxRequestsPerMin) {
    return true
  }
  
  activeTimestamps.push(now)
  rateLimitMap.set(userId, { timestamps: activeTimestamps })
  return false
}

// Simple SHA-256 hash helper using web crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  const timestamp = new Date().toISOString()
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Generate Request ID
  const requestId = crypto.randomUUID()
  console.log(`[${timestamp}] [ReqId: ${requestId}] Starting create-staff-user request...`)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_SESSION_REVOKED',
          message: 'Missing authorization header.',
          details: {},
          timestamp
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Initialize User Client correctly with anon key + user token header
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: { persistSession: false }
    })

    // Get Auth User
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser()
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_SESSION_REVOKED',
          message: 'Invalid auth token session.',
          details: {},
          timestamp
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting check
    if (isRateLimited(authUser.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many user creation requests. Rate limit of 10 requests/minute exceeded.',
          details: {},
          timestamp
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check permissions using the new permission engine
    const { data: hasPerm, error: permError } = await userClient.rpc('has_permission', {
      p_permission_key: 'users.create'
    })

    if (permError || !hasPerm) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_PERMISSION_DENIED',
          message: 'Permission denied: Only Owners or authorized Managers can create staff.',
          details: {},
          timestamp
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Admin Client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Get Creator Profile
    const { data: profile } = await adminClient
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!profile) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'PROFILE_NOT_FOUND',
          message: 'Caller user profile not found.',
          details: {},
          timestamp
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse Body
    const bodyText = await req.text()
    const requestHash = await sha256(bodyText)
    const payload = JSON.parse(bodyText)
    const { email, password, fullName, phone, roleId } = payload

    if (!email || !fullName || !roleId) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'IMPORT_VALIDATION_FAILED',
          message: 'Missing required fields: Email, Name, and Role are mandatory.',
          details: {},
          timestamp
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Idempotency Key Handling
    const idempotencyKey = req.headers.get('idempotency-key')
    if (idempotencyKey) {
      // Check if key already exists
      const { data: existingKey } = await adminClient
        .from('idempotency_keys')
        .select('*')
        .eq('key', idempotencyKey)
        .maybeSingle()

      if (existingKey) {
        if (existingKey.request_hash !== requestHash) {
          return new Response(
            JSON.stringify({
              success: false,
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'This Idempotency Key was already used with a different request body payload.',
              details: {},
              timestamp
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Return original response payload
        return new Response(
          JSON.stringify(existingKey.response_payload),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Lock key as processing
      await adminClient.from('idempotency_keys').insert({
        key: idempotencyKey,
        request_hash: requestHash,
        response_payload: {},
        request_status: 'processing',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
      })
    }

    // Validate target role
    const { data: targetRole } = await adminClient
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .eq('restaurant_id', profile.restaurant_id)
      .maybeSingle()

    if (!targetRole) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_ROLE',
          message: 'Assigned role not found or belongs to another restaurant.',
          details: {},
          timestamp
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (targetRole.name === 'Owner') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'ROLE_NOT_ALLOWED',
          message: 'Cannot create other Owner accounts.',
          details: {},
          timestamp
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let newAuthUser
    let isInvitation = false

    // 1. Onboarding workflow: Invite or Password Create
    if (!password) {
      isInvitation = true
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${req.headers.get('origin') ?? 'http://localhost:5173'}/login`,
        data: {
          full_name: fullName,
          restaurant_id: profile.restaurant_id,
          role_id: roleId
        }
      })
      if (inviteError || !inviteData?.user) {
        throw new Error(inviteError?.message || 'Failed to trigger user email invitation.')
      }
      newAuthUser = inviteData.user
      
      // Store pending invitation details
      const invitationTokenHash = await sha256(newAuthUser.id + email)
      await adminClient.from('invitations').insert({
        email,
        restaurant_id: profile.restaurant_id,
        role_id: roleId,
        status: 'pending',
        invitation_token_hash: invitationTokenHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours expiry
        created_by: authUser.id
      })

    } else {
      const { data: signupData, error: signupError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          restaurant_id: profile.restaurant_id,
          role_id: roleId
        }
      })
      if (signupError || !signupData?.user) {
        console.error("Signup Error Details:", JSON.stringify(signupError, null, 2))
        throw new Error(signupError?.message || 'Failed to register authentication credentials.')
      }
      newAuthUser = signupData.user
    }

    // 2. Trigger trg_handle_new_user automatically creates public row. Update phone.
    const { error: updateProfileError } = await adminClient
      .from('users')
      .update({ phone: phone || null })
      .eq('id', newAuthUser.id)

    if (updateProfileError) {
      await adminClient.auth.admin.deleteUser(newAuthUser.id)
      throw updateProfileError
    }

    // 3. Structured audit logging
    const metaData = {
      browser: req.headers.get('sec-ch-ua') || 'Unknown',
      operating_system: req.headers.get('sec-ch-ua-platform') || 'Unknown',
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      request_id: requestId,
    }

    await adminClient.rpc('log_activity', {
      p_action: 'CREATE_USER',
      p_module: 'users',
      p_entity: 'users',
      p_entity_id: newAuthUser.id,
      p_restaurant_id: profile.restaurant_id,
      p_actor_id: authUser.id,
      p_old_values: null,
      p_new_values: {
        email: email,
        full_name: fullName,
        phone: phone,
        role_name: targetRole.name,
        is_invitation: isInvitation
      },
      p_metadata: metaData
    })

    const finalResponse = {
      success: true,
      code: isInvitation ? 'INVITATION_SENT' : 'USER_CREATED',
      message: isInvitation ? 'Invitation sent to email successfully.' : 'Staff user registered successfully.',
      data: { id: newAuthUser.id },
      meta: { request_id: requestId },
      timestamp
    }

    // Update idempotency key status to completed
    if (idempotencyKey) {
      await adminClient
        .from('idempotency_keys')
        .update({
          request_status: 'completed',
          response_payload: finalResponse
        })
        .eq('key', idempotencyKey)
    }

    return new Response(
      JSON.stringify(finalResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error(`[ReqId: ${requestId}] Full Error Object:`, err)
    
    // Clear idempotency key on failure
    const idempotencyKey = req.headers.get('idempotency-key')
    if (idempotencyKey) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      })
      await adminClient.from('idempotency_keys').delete().eq('key', idempotencyKey)
    }

    const isEmailExists = err.message?.includes('already been registered') || err.message?.includes('already exists');
    return new Response(
      JSON.stringify({
        success: false,
        code: isEmailExists ? 'EMAIL_EXISTS' : 'INTERNAL_ERROR',
        message: err.message || 'An unexpected server error occurred.',
        details: {},
        timestamp
      }),
      { 
        status: isEmailExists ? 400 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
