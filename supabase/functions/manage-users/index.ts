
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { action, userId, userData } = await req.json()
    console.log('Received request:', { action, userId, userData })

    switch (action) {
      case 'list':
        const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
        if (listError) throw listError
        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'create':
        // Get department_id from the department name if provided
        let departmentId = null;
        if (userData.departments && userData.departments.length > 0) {
          const { data: departmentData, error: departmentError } = await supabaseClient
            .from('departments')
            .select('id')
            .eq('name', userData.departments[0])
            .single();

          if (departmentError) {
            console.error('Error fetching department ID:', departmentError);
          } else if (departmentData) {
            departmentId = departmentData.id;
          }
        }

        const { data: createData, error: createError } = await supabaseClient.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            departments: userData.departments,
            department_id: departmentId,
            assigned_class: userData.assigned_class
          }
        })
        if (createError) throw createError
        return new Response(JSON.stringify(createData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'update':
        // Get department_id from the department name if provided
        let updatedDepartmentId = null;
        if (userData.departments && userData.departments.length > 0) {
          const { data: departmentData, error: departmentError } = await supabaseClient
            .from('departments')
            .select('id')
            .eq('name', userData.departments[0])
            .single();

          if (departmentError) {
            console.error('Error fetching department ID:', departmentError);
          } else if (departmentData) {
            updatedDepartmentId = departmentData.id;
          }
        }

        const updates: any = {
          user_metadata: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            departments: userData.departments,
            department_id: updatedDepartmentId,
            assigned_class: userData.assigned_class
          }
        }

        if (userData.email) {
          updates.email = userData.email
        }

        if (userData.password) {
          updates.password = userData.password
        }

        const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
          userId,
          updates
        )
        if (updateError) throw updateError
        return new Response(JSON.stringify(updateData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'delete':
        const { data: deleteData, error: deleteError } = await supabaseClient.auth.admin.deleteUser(
          userId
        )
        if (deleteError) throw deleteError
        return new Response(JSON.stringify(deleteData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'bulk-create':
        const { users: usersToCreate } = userData;
        console.log(`Processing bulk create for ${usersToCreate?.length} users`);

        if (!usersToCreate || !Array.isArray(usersToCreate)) {
          throw new Error('Invalid users data for bulk-create');
        }

        // 1. Fetch all departments once to avoid redundant queries
        const { data: deptList, error: deptListError } = await supabaseClient
          .from('departments')
          .select('id, name');

        if (deptListError) {
          console.error('Error fetching departments for bulk lookup:', deptListError);
        }

        const deptMap = Object.fromEntries(deptList?.map(d => [d.name, d.id]) || []);

        const bulkResults = [];
        const batchSize = 10;

        for (let i = 0; i < usersToCreate.length; i += batchSize) {
          const batch = usersToCreate.slice(i, i + batchSize);
          const batchPromises = batch.map(async (u: any) => {
            try {
              const departmentId = u.department ? deptMap[u.department] : null;

              const { data, error } = await supabaseClient.auth.admin.createUser({
                email: u.email,
                password: u.password || Math.random().toString(36).slice(-10),
                email_confirm: true,
                user_metadata: {
                  first_name: u.first_name,
                  last_name: u.last_name || '',
                  role: u.role || 'maestro',
                  departments: u.department ? [u.department] : [],
                  department_id: departmentId,
                  assigned_class: u.assigned_class || ''
                }
              });

              if (error) {
                console.error(`Error creating user ${u.email}:`, error.message);
                return { email: u.email, success: false, error: error.message };
              }

              return { email: u.email, success: true, userId: data.user.id };
            } catch (err: any) {
              console.error(`Unexpected error for ${u.email}:`, err.message);
              return { email: u.email, success: false, error: err.message };
            }
          });

          const chunkResults = await Promise.all(batchPromises);
          bulkResults.push(...chunkResults);
        }

        return new Response(JSON.stringify({ results: bulkResults }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'updateDepartmentIds':
        // This action will update department_ids for all users
        const { data: allUsers, error: allUsersError } = await supabaseClient.auth.admin.listUsers()
        if (allUsersError) throw allUsersError

        const results = [];

        for (const user of allUsers.users) {
          const departments = user.user_metadata?.departments;

          if (departments && departments.length > 0) {
            const { data: departmentData, error: departmentError } = await supabaseClient
              .from('departments')
              .select('id')
              .eq('name', departments[0])
              .single();

            if (departmentError) {
              console.error(`Error fetching department ID for user ${user.id}:`, departmentError);
              results.push({ userId: user.id, success: false, error: departmentError.message });
              continue;
            }

            if (departmentData) {
              const metadata = { ...user.user_metadata, department_id: departmentData.id };

              const { data: updatedUser, error: updateError } = await supabaseClient.auth.admin.updateUserById(
                user.id,
                { user_metadata: metadata }
              );

              if (updateError) {
                console.error(`Error updating user ${user.id}:`, updateError);
                results.push({ userId: user.id, success: false, error: updateError.message });
              } else {
                results.push({ userId: user.id, success: true });

                // Update the profile table too
                const { error: profileError } = await supabaseClient
                  .from('profiles')
                  .update({ department_id: departmentData.id })
                  .eq('id', user.id);

                if (profileError) {
                  console.error(`Error updating profile for user ${user.id}:`, profileError);
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error(`Unsupported action: ${action}`)
    }
  } catch (error) {
    console.error('Error in manage-users function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
