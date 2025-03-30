
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
        console.log("Create user with full userData:", JSON.stringify(userData, null, 2));
        
        // Remove department_id from the user_metadata completely
        // We'll handle it separately in the database trigger
        const userMetadata = {
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          departments: userData.departments || [],
          assigned_class: userData.assigned_class || null
        };
        
        // Create the user without department_id in metadata
        const { data: createData, error: createError } = await supabaseClient.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: userMetadata
        });
        
        if (createError) {
          console.error("Error creating user:", createError);
          throw createError;
        }
        
        // If user was created successfully and we have a department_id,
        // update the profile table directly with the correctly typed UUID
        if (createData && userData.department_id) {
          try {
            console.log(`Updating profile with department_id: ${userData.department_id}`);
            const { error: profileError } = await supabaseClient
              .from('profiles')
              .update({ department_id: userData.department_id })
              .eq('id', createData.user.id);
              
            if (profileError) {
              console.error("Error updating profile department_id:", profileError);
            }
          } catch (err) {
            console.error("Exception updating profile department_id:", err);
          }
        }
        
        return new Response(JSON.stringify(createData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'update':
        console.log("Update user with full userData:", JSON.stringify(userData, null, 2));

        // Remove department_id from the metadata update
        const updates = {
          user_metadata: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            departments: userData.departments || [],
            assigned_class: userData.assigned_class || null
          }
        };

        if (userData.email) {
          updates.email = userData.email;
        }
        
        if (userData.password) {
          updates.password = userData.password;
        }

        const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
          userId,
          updates
        );
        
        if (updateError) throw updateError;
        
        // Update the department_id separately if provided
        if (userData.department_id) {
          try {
            const { error: deptUpdateError } = await supabaseClient
              .from('profiles')
              .update({ department_id: userData.department_id })
              .eq('id', userId);
              
            if (deptUpdateError) {
              console.error("Error updating profile department_id:", deptUpdateError);
            }
          } catch (err) {
            console.error("Exception updating profile department_id:", err);
          }
        }
        
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
