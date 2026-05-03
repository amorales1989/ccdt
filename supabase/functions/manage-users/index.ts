
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

    // Diagnóstico de columnas
    const { data: colInfo } = await supabaseClient.from('profiles').select('*').limit(1);
    if (colInfo && colInfo.length > 0) {
      console.log('COLUMNAS DISPONIBLES EN PROFILES:', Object.keys(colInfo[0]));
    }

    switch (action) {
      case 'list':
        const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
        if (listError) throw listError
        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'create':
        let departmentId = userData.department_id;
        if (!departmentId && userData.departments && userData.departments.length > 0) {
          const { data: departmentData, error: departmentError } = await supabaseClient
            .from('departments')
            .select('id')
            .eq('name', userData.departments[0])
            .single();

          if (departmentError) {
            console.error('Error fetching department ID for create:', departmentError);
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
            roles: userData.roles || (userData.role ? [userData.role] : []),
            departments: userData.departments,
            department_id: departmentId || null,
            assigned_class: userData.assigned_class || null,
            phone: userData.phone,
            birthdate: userData.birthdate,
            gender: userData.gender,
            address: userData.address,
            document_number: userData.document_number,
            is_member: userData.is_member || false,
            company_id: userData.company_id,
            assignments: userData.assignments || []
          }
        })
        if (createError) throw createError

        // Sync with profiles table
        if (createData.user) {
          console.log(`Syncing profile for new user ${createData.user.id}. Assignments:`, JSON.stringify(userData.assignments));
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
              id: createData.user.id,
              first_name: userData.first_name,
              last_name: userData.last_name,
              role: userData.role,
              roles: userData.roles || [userData.role],
              departments: userData.departments,
              department_id: departmentId || null,
              assigned_class: userData.assigned_class || null,
              phone: userData.phone ?? null,
              birthdate: userData.birthdate ?? null,
              gender: userData.gender ?? null,
              address: userData.address ?? null,
              document_number: userData.document_number ?? null,
              is_member: userData.is_member ?? false,
              company_id: userData.company_id ?? null,
            }, { onConflict: 'id' });

          if (profileError) {
            console.error('Error syncing profile on create:', profileError);
            throw new Error('Profile sync failed on create: ' + profileError.message);
          }
        }

        return new Response(JSON.stringify(createData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'update':
        let updatedDepartmentId = userData.department_id;
        if (!updatedDepartmentId && userData.departments && userData.departments.length > 0) {
          const { data: departmentData, error: departmentError } = await supabaseClient
            .from('departments')
            .select('id')
            .eq('name', userData.departments[0])
            .single();

          if (departmentError) {
            console.error('Error fetching department ID for update:', departmentError);
          } else if (departmentData) {
            updatedDepartmentId = departmentData.id;
          }
        }

        const updates: any = {
          user_metadata: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            roles: userData.roles || (userData.role ? [userData.role] : []),
            departments: userData.departments,
            department_id: updatedDepartmentId || null,
            assigned_class: userData.assigned_class || null,
            phone: userData.phone,
            birthdate: userData.birthdate,
            gender: userData.gender,
            address: userData.address,
            document_number: userData.document_number,
            is_member: userData.is_member || false,
            assignments: userData.assignments || []
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

        // Sync with profiles table — usar UPDATE directo (la fila siempre existe en update)
        console.log(`Syncing profile for existing user ${userId}.`);

        const { error: profileSyncError } = await supabaseClient
          .from('profiles')
          .update({
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            roles: userData.roles || [userData.role],
            departments: userData.departments,
            department_id: updatedDepartmentId || null,
            assigned_class: userData.assigned_class || null,
            phone: userData.phone ?? null,
            birthdate: userData.birthdate ?? null,
            gender: userData.gender ?? null,
            address: userData.address ?? null,
            document_number: userData.document_number ?? null,
            is_member: userData.is_member ?? false,
            company_id: userData.company_id ?? null,
          })
          .eq('id', userId);

        if (profileSyncError) {
          console.error('CRITICAL: Error syncing profile on update:', profileSyncError);
          throw new Error('Profile sync failed: ' + profileSyncError.message);
        }

        console.log('Profile sync successful');

        return new Response(JSON.stringify({ ...updateData, assignments: userData.assignments }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'delete':
        // First delete from profiles table
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .delete()
          .eq('id', userId)

        if (profileError) {
          console.error('Error deleting profile:', profileError)
        }

        // Soft delete from students table if there's an associated record
        const { error: studentError } = await supabaseClient
          .from('students')
          .update({ deleted_at: new Date().toISOString() })
          .eq('profile_id', userId)

        if (studentError) {
          console.error('Error deleting associated student:', studentError)
        }

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

              const userPassword = u.password || '123456';
              const userMetadata = {
                first_name: u.first_name,
                last_name: u.last_name || '',
                role: u.role || 'maestro',
                roles: u.roles || [u.role || 'maestro'],
                departments: u.department ? [u.department] : [],
                department_id: departmentId,
                assigned_class: u.assigned_class || '',
                phone: u.phone,
                birthdate: u.birthdate,
                address: u.address,
                document_number: u.document_number,
                company_id: u.company_id
              };

              let { data, error } = await supabaseClient.auth.admin.createUser({
                email: u.email,
                password: userPassword,
                email_confirm: true,
                user_metadata: userMetadata
              });

              if (error && error.message.toLowerCase().includes('already registered')) {
                console.log(`User ${u.email} already exists, attempting to update password and metadata.`);

                // Find existing user to get their ID
                const { data: profileData } = await supabaseClient
                  .from('profiles')
                  .select('id')
                  .eq('email', u.email)
                  .single();

                if (profileData?.id) {
                  const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
                    profileData.id,
                    {
                      password: userPassword,
                      user_metadata: userMetadata
                    }
                  );
                  data = updateData;
                  error = updateError;
                } else {
                  // Fallback to searching in Auth if not in profiles
                  const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers();
                  const authUser = users?.find(user => user.email === u.email);
                  if (authUser) {
                    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
                      authUser.id,
                      {
                        password: userPassword,
                        user_metadata: userMetadata
                      }
                    );
                    data = updateData;
                    error = updateError;
                  }
                }
              }

              if (error) {
                console.error(`Error processing user ${u.email}:`, error.message);
                return { email: u.email, success: false, error: error.message };
              }

              // Sync with profiles table - Use upsert to handle potential race conditions or missing rows
              const { error: profileError } = await supabaseClient
                .from('profiles')
                .upsert({
                  id: data.user.id,
                  first_name: u.first_name,
                  last_name: u.last_name || '',
                  email: u.email,
                  role: u.role || 'maestro',
                  roles: u.roles || [u.role || 'maestro'],
                  departments: u.department ? [u.department] : [],
                  department_id: departmentId,
                  assigned_class: u.assigned_class || '',
                  phone: u.phone ?? null,
                  birthdate: u.birthdate ?? null,
                  address: u.address ?? null,
                  document_number: u.document_number ?? null,
                  company_id: u.company_id
                }, { onConflict: 'id' });

              if (profileError) {
                console.error(`Error syncing profile for bulk-create user ${u.email}:`, profileError);
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
                  .eq('id', user.id)
                  .eq('company_id', user.user_metadata?.company_id);

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
