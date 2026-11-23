(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const cfg = window.MEMBERSHIP_CONFIG || {};
const url = String(cfg.supabaseUrl || "").trim();
const key = String(cfg.supabasePublishableKey || cfg.supabaseAnonKey || "").trim();
const state = { client:null, admin:null, students:[], definitions:[], courses:[], modes:[], grants:[], audit:[] };

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);

function message(text, error=false) {
  const el = $("message");
  el.textContent = text;
  el.className = "notice" + (error ? " error" : "");
  el.hidden = !text;
}
function selectedStudent() {
  return state.students.find(s => s.user_id === $("studentSelect").value);
}
function personName(id) {
  const p = state.students.find(s => s.user_id === id);
  return p?.full_name || p?.email || id;
}

async function boot() {
  if (!window.supabase?.createClient ||
      !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
      window.isMembershipPublicKey?.(key) !== true) {
    throw new Error("إعداد Supabase غير مكتمل.");
  }
  state.client = window.supabase.createClient(url, key, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const {data,error} = await state.client.auth.getSession();
  if(error) throw error;
  if(!data.session) {
    $("loginPanel").hidden = false;
    return;
  }
  const {data:isAdmin,error:adminError} = await state.client.rpc("is_platform_admin");
  if(adminError || isAdmin !== true) throw new Error("هذه الصفحة متاحة لمدير المنصة المعتمد فقط.");
  const {data:profile,error:profileError} = await state.client.from("profiles")
    .select("role,status,account_state")
    .eq("user_id",data.session.user.id).maybeSingle();
  if(profileError || profile?.role !== "admin" || profile?.status !== "approved" ||
     profile?.account_state !== "active") {
    throw new Error("حساب الإدارة غير معتمد أو غير نشط.");
  }
  state.admin = data.session.user;
  $("workspace").hidden = false;
  await loadData();
}

async function loadData() {
  const db = state.client;
  const results = await Promise.all([
    db.from("profiles").select("user_id,full_name,email,role,status,account_state")
      .eq("role","student").order("full_name"),
    db.from("platform_permission_definitions")
      .select("permission_code,permission_name,category,description,resource,action,is_active,is_system")
      .order("category").order("permission_name"),
    db.from("course_catalog").select("course_slug,title,is_active").eq("is_active",true).order("title"),
    db.from("user_permission_profiles").select("user_id,permission_mode,updated_at"),
    db.from("user_permission_grants")
      .select("id,user_id,permission_code,scope_course_slug,is_active,valid_from,valid_until,created_at")
      .order("created_at",{ascending:false}),
    db.from("platform_permission_audit_log")
      .select("id,actor_user_id,target_user_id,permission_code,event_type,created_at")
      .order("created_at",{ascending:false}).limit(50)
  ]);
  const labels = ["المتدربون","تعريفات الصلاحيات","الدورات","أوضاع الصلاحيات","منح الصلاحيات","سجل التدقيق"];
  results.forEach((r,i) => {
    if(r.error) throw new Error(labels[i] + ": " + r.error.message);
  });
  [state.students,state.definitions,state.courses,state.modes,state.grants,state.audit] =
    results.map(r => r.data || []);

  $("studentSelect").innerHTML = '<option value="">اختر متدربًا</option>' +
    state.students.map(s =>
      '<option value="' + esc(s.user_id) + '">' +
      esc(s.full_name || "متدرب") + " — " + esc(s.email || "") + "</option>"
    ).join("");
  $("permissionSelect").innerHTML = '<option value="">اختر صلاحية</option>' +
    state.definitions.filter(p => p.is_active).map(p =>
      '<option value="' + esc(p.permission_code) + '">' +
      esc(p.permission_name) + " (" + esc(p.permission_code) + ")</option>"
    ).join("");
  $("courseScope").innerHTML = '<option value="">كل الدورات / صلاحية عامة</option>' +
    state.courses.map(c =>
      '<option value="' + esc(c.course_slug) + '">' +
      esc(c.title) + " — " + esc(c.course_slug) + "</option>"
    ).join("");
  renderAudit();
  renderStudent();
}

function renderStudent() {
  const student = selectedStudent();
  if(!student) {
    $("permissionMode").value = "inherit";
    $("selectedStudentState").textContent = "لم يتم اختيار متدرب";
    $("grantsList").textContent = "اختر متدربًا لعرض صلاحياته.";
    return;
  }

  const mode = state.modes.find(m => m.user_id === student.user_id)?.permission_mode || "inherit";
  $("permissionMode").value = mode;
  $("selectedStudentState").textContent =
    (student.status || "—") + " · " + (student.account_state || "—") + " · " +
    (mode === "custom" ? "صلاحيات مخصصة" : "صلاحيات موروثة");

  const grants = state.grants.filter(g => g.user_id === student.user_id);
  if(!grants.length) {
    $("grantsList").textContent = "لا توجد منح فردية مسجلة لهذا المتدرب.";
    return;
  }

  $("grantsList").innerHTML = grants.map(g => {
    const d = state.definitions.find(x => x.permission_code === g.permission_code);
    const scope = g.scope_course_slug ? "الدورة: " + esc(g.scope_course_slug) : "نطاق عام";
    const expiry = g.valid_until ? "تنتهي: " + esc(new Date(g.valid_until).toLocaleString("ar-EG")) : "دون تاريخ انتهاء";
    const revokeButton = g.is_active
      ? '<button class="danger" type="button" data-revoke="' + esc(g.permission_code) +
        '" data-scope="' + esc(g.scope_course_slug || "") + '">إيقاف</button>'
      : "";
    return '<div class="permission-row"><div><strong>' +
      esc(d?.permission_name || g.permission_code) + '</strong><div>' +
      esc(g.permission_code) + " · " + scope + " · " + expiry +
      '</div><span class="pill">' + (g.is_active ? "نشطة" : "موقوفة") +
      "</span></div>" + revokeButton + "</div>";
  }).join("");

  $("grantsList").querySelectorAll("[data-revoke]").forEach(button => {
    button.addEventListener("click", async () => {
      const {error} = await state.client.rpc("admin_revoke_user_permission", {
        p_user_id:student.user_id,
        p_permission_code:button.dataset.revoke,
        p_scope_course_slug:button.dataset.scope || null
      });
      if(error) { message(error.message,true); return; }
      message("تم إيقاف الصلاحية وتسجيل العملية.");
      await loadData();
    });
  });
}

function renderAudit() {
  $("auditBody").innerHTML = state.audit.map(row => {
    const dateText = new Date(row.created_at).toLocaleString("ar-EG");
    const event = ({
      permission_created:"إنشاء تعريف صلاحية",
      permission_updated:"تعديل تعريف صلاحية",
      mode_changed:"تغيير وضع الصلاحيات",
      grant_created:"منح صلاحية",
      grant_updated:"تحديث منحة",
      grant_revoked:"إيقاف صلاحية"
    })[row.event_type] || row.event_type;
    return "<tr><td>" + esc(dateText) + "</td><td>" +
      esc(row.target_user_id ? personName(row.target_user_id) : "—") +
      "</td><td>" + esc(event) + "</td><td>" +
      esc(row.permission_code || "—") + "</td></tr>";
  }).join("");
}

$("studentSelect").addEventListener("change",renderStudent);

$("saveMode").addEventListener("click",async()=>{
  const student = selectedStudent();
  if(!student) { message("اختر المتدرب أولًا.",true); return; }
  const {error} = await state.client.rpc("admin_set_user_permission_mode", {
    p_user_id:student.user_id,
    p_mode:$("permissionMode").value
  });
  if(error) { message(error.message,true); return; }
  message("تم حفظ وضع الصلاحيات.");
  await loadData();
});

$("grantButton").addEventListener("click",async()=>{
  const student = selectedStudent();
  const code = $("permissionSelect").value;
  if(!student || !code) { message("اختر المتدرب والصلاحية أولًا.",true); return; }
  const rawExpiry = $("validUntil").value;
  const validUntil = rawExpiry ? new Date(rawExpiry).toISOString() : null;
  const {error} = await state.client.rpc("admin_grant_user_permission", {
    p_user_id:student.user_id,
    p_permission_code:code,
    p_scope_course_slug:$("courseScope").value || null,
    p_valid_from:new Date().toISOString(),
    p_valid_until:validUntil
  });
  if(error) { message(error.message,true); return; }
  message("تم منح الصلاحية. تظل شروط اشتراك Membership V2 والدفع واجبة للدورات.");
  $("validUntil").value = "";
  await loadData();
});

$("createPermission").addEventListener("click",async()=>{
  const payload = {
    p_permission_code:$("newCode").value.trim().toLowerCase(),
    p_permission_name:$("newName").value.trim(),
    p_category:$("newCategory").value.trim(),
    p_description:$("newDescription").value.trim(),
    p_resource:$("newResource").value.trim().toLowerCase(),
    p_action:$("newAction").value.trim().toLowerCase(),
    p_is_active:true
  };
  if(!payload.p_permission_code || !payload.p_permission_name ||
     !payload.p_category || !payload.p_resource || !payload.p_action) {
    message("أكمل الرمز والاسم والتصنيف والمورد ونوع الإجراء.",true);
    return;
  }
  const {error} = await state.client.rpc("admin_upsert_platform_permission",payload);
  if(error) { message(error.message,true); return; }
  message("تم حفظ تعريف الصلاحية. اربطه بمسار خادم أو سياسة RLS حتى يُطبق على وظيفة فعلية.");
  ["newCode","newName","newCategory","newDescription","newResource","newAction"].forEach(id => $(id).value = "");
  await loadData();
});

boot().catch(error => message(error.message || "تعذر تحميل لوحة الصلاحيات.",true));
})();