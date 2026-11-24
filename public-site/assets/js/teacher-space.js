(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;

  function show(message, error = false) {
    const host = $("pageMessage");
    host.textContent = message;
    host.className = "notice" + (error ? " error" : "");
    host.hidden = !message;
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

  const permissionLabels = {
    "students.view":"مشاهدة الطلاب",
    "students.view_progress":"مشاهدة التقدم",
    "students.view_assessments":"مشاهدة نتائج التقييم",
    "students.view_contact":"بيانات التواصل",
    "lessons.manage":"إدارة الدروس",
    "assessments.manage":"إدارة الاختبارات",
    "assignments.grade":"تصحيح التكليفات",
    "students.message":"مراسلة الطلاب"
  };

  async function boot() {
    if (!window.supabase?.createClient ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
        window.isMembershipPublicKey?.(key) !== true) {
      show("إعداد الاتصال بالمنصة غير مكتمل.", true);
      return;
    }

    client = window.supabase.createClient(url, key, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });

    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError) throw sessionError;
    if(!sessionData.session) {
      const next = "teacher-space.html" + window.location.search;
      window.location.replace("student-login.html?next=" + encodeURIComponent(next));
      return;
    }

    const user=sessionData.session.user;
    const {data:profile,error:profileError}=await client
      .from("profiles")
      .select("full_name,role,status,account_state")
      .eq("user_id",user.id)
      .maybeSingle();
    if(profileError) throw profileError;
    if(!profile) {
      show("لم يتم العثور على ملف الحساب.",true);
      return;
    }

    if(profile.role==="admin") {
      const {data:allowed,error}=await client.rpc("is_platform_admin");
      if(error) throw error;
      if(allowed===true) {
        window.location.replace("admin-dashboard.html");
        return;
      }
    } else if(profile.role==="student") {
      window.location.replace("student-space.html");
      return;
    }

    if(profile.role!=="teacher" || profile.status!=="approved" || profile.account_state!=="active") {
      show("هذه المساحة مخصصة لحساب مدرس معتمد ونشط. راجع حالة حسابك مع الإدارة.",true);
      return;
    }

    $("teacherName").textContent=profile.full_name || user.email || "المدرس";

    const [assignmentsResult,permissionsResult]=await Promise.all([
      client.from("teacher_course_assignments")
        .select("course_slug,is_active,assigned_at")
        .eq("teacher_user_id",user.id)
        .eq("is_active",true)
        .order("assigned_at",{ascending:false}),
      client.from("teacher_permissions")
        .select("permission_key,enabled,updated_at")
        .eq("teacher_user_id",user.id)
        .order("permission_key")
    ]);
    if(assignmentsResult.error) throw assignmentsResult.error;
    if(permissionsResult.error) throw permissionsResult.error;

    const assignments=Array.isArray(assignmentsResult.data)?assignmentsResult.data:[];
    const permissions=Array.isArray(permissionsResult.data)?permissionsResult.data:[];
    const slugs=[...new Set(assignments.map(item=>item.course_slug).filter(Boolean))];

    let courses=[];
    if(slugs.length) {
      const {data,error}=await client.from("course_catalog")
        .select("course_slug,title,description")
        .in("course_slug",slugs)
        .eq("is_active",true)
        .order("title");
      if(error) throw error;
      courses=Array.isArray(data)?data:[];
    }

    const courseHost=$("teacherCourses");
    courseHost.replaceChildren();
    if(!courses.length) {
      const empty=document.createElement("div");
      empty.className="empty";
      empty.textContent="لم يتم إسناد أي مقرر نشط إلى حسابك حتى الآن. ستظهر المقررات هنا تلقائيًا بعد أن يحدد المدير المقررات المسموح لك بتدريسها.";
      courseHost.appendChild(empty);
    } else {
      for(const course of courses) {
        const card=document.createElement("article");
        card.className="course-card";
        const title=document.createElement("h3");
        title.textContent=course.title||course.course_slug;
        const slug=document.createElement("div");
        slug.className="course-meta";
        slug.textContent=course.course_slug;
        const description=document.createElement("p");
        description.textContent=course.description||"لم يضف وصف لهذا المقرر بعد.";
        const state=document.createElement("div");
        state.className="notice";
        state.textContent="تم إسناد المقرر إلى حسابك. عرض محتوى المحاضرات غير مفعّل لهذا الدور في سياسة الوصول الحالية.";
        card.append(title,slug,description,state);
        courseHost.appendChild(card);
      }
    }

    const permissionHost=$("teacherPermissions");
    permissionHost.replaceChildren();
    const activePermissions=permissions.filter(item=>item.enabled===true);
    if(!activePermissions.length) {
      const empty=document.createElement("div");
      empty.className="empty";
      empty.textContent="لا توجد صلاحيات إضافية مفعّلة لحسابك حاليًا.";
      permissionHost.appendChild(empty);
    } else {
      for(const item of activePermissions) {
        const chip=document.createElement("span");
        chip.className="permission";
        chip.textContent=permissionLabels[item.permission_key]||item.permission_key;
        permissionHost.appendChild(chip);
      }
    }

    $("teacherContent").hidden=false;
    show(assignments.length
      ? "تم التحقق من حساب المدرس وتحميل المقررات والصلاحيات المسندة."
      : "تم التحقق من حساب المدرس. لا توجد إسنادات مقررات حتى الآن.");
  }

  $("logoutButton").addEventListener("click",async()=>{
    if(client) await client.auth.signOut();
    window.location.replace("student-login.html");
  });

  boot().catch(error=>show(error?.message||"تعذر تحميل مساحة المدرس.",true));
})();