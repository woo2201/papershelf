/* Data layer: no service-role key. Authorization lives in Postgres RLS. */
window.blogClient = PapershelfSupabase.createClient(
  'https://shpiczkprbylbhtomynw.supabase.co',
  'sb_publishable_Ecbrtl4oSXyjlZ4mIjmF6A_lXjU8_QT',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'papershelf-blog-session'}}
);
window.blogState = {admin:false,user:null,epoch:0,ready:false,busy:false,settings:null,editVersion:0,editEntry:null};
