import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify caller is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      throw new Error('Forbidden — admin access required')
    }

    const body = await req.json()
    const {
      email, full_name, phone, department, position,
      employment_date, basic_salary, employee_id, status
    } = body

    if (!email || !full_name) throw new Error('email and full_name are required')

    // Invite the user (sends email with magic link to set password)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        role: 'employee',
      },
    })

    if (inviteError) throw inviteError

    const userId = inviteData.user.id

    // Update the profile created by the trigger
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        employee_id,
        full_name,
        phone: phone || null,
        department: department || null,
        position: position || null,
        employment_date: employment_date || null,
        basic_salary: parseFloat(basic_salary) || 0,
        status: status || 'active',
        role: 'employee',
        must_change_password: true,
      })
      .eq('id', userId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, employee_id: userId, message: `Invitation sent to ${email}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('create-employee error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
