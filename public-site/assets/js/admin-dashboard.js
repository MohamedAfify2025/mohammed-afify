(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const config = window.MEMBERSHIP_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let client = null;
  let courses = [];
  let lessons = [];
  let isLoading = false;

  const sections = [
    {group:"الإدارة",items:[
      ["👥","إدارة الطلاب والدعوات","دعوة المتدربين ومراجعة الحسابات والترقية الإدارية.","admin-students.html"],
      ["💳","الاشتراكات والمدفوعات","الباقات والاشتراكات والتفعيل والمدفوعات والصلاحيات الفردية.","admin-subscriptions.html"],
      ["🎓","إدارة المقررات والمحتوى","تعديل بيانات الدورات وإضافة المحاضرات ونشرها وإدارة الملفات.","admin-course-manager.html"],
      ["📚","كل المحتوى التعليمي","عرض كل المقررات ومحاضراتها بما فيها المسودات وغير المنشورة.","student-space.html"],
      ["📤","رفع محاضرة المحاسبة","أداة الرفع القديمة المخصصة لمحاضرة المحاسبة الأولى.","lesson-admin-upload.html"]
    ]},
    {group:"واجهة المنصة",items:[
      ["🏠","الصفحة الرئيسية","عرض واجهة المنصة ومسارات التعلم والخدمات والموارد.","index.html"],
      ["🗂️","المكتبة التعليمية","عرض فهرس الدورات والوصف العام وسلوك الزائر.","academy-access.html"],
      ["⚙️","حلول Odoo","صفحات برامج الحضانات والمراكز والمدارس والعيادات والموارد البشرية.","odoo-solutions.html"],
      ["🧭","دليل استخدام المنصة","شرح مسارات المدير والمتدرب وخطوات الاستخدام.","student-guide.html"]
    ]},
    {group:"حسابات واختبار",items:[
      ["🔐","صفحة تسجيل الدخول","اختبار مسار دخول المتدرب والمدير.","student-login.html"],
      ["📝","طلب اشتراك جديد","نموذج إنشاء الحساب وطلب الدورة من منظور الزائر.","student-subscribe.html"],
      ["👁️","معاينة دورة عامة","معاينة بيانات الدورة كما يراها الزائر؛ استبدل الرمز برمز أي مقرر.","course-preview.html?course=icdl"]
    ]}
  ];

  function show(message, error=false) {
    const host=$("pageMessage");
    host.textContent=message;
    host.className="notice"+(error?" error":"");
    host.hidden=!message;
  }

  function countQuery(table,column,filters=[]) {
    let query=client.from(table).select(column,{count:"exact",head:true});
    for(const filter of filters) query=query.eq(filter[0],filter[1]);
    return query;
  }

  async function countValue(table,column,filters=[]) {
    const {count,error}=await countQuery(table,column,filters);
    if(error) throw new Error("تعذر قراءة عدد "+table+": "+error.message);
    return Number(count||0);
  }

  async function verifyAdmin() {
    const {data:userData,error:userError}=await client.auth.getUser();
    if(userError) throw userError;
    const user=userData?.user;
    if(!user) {
      window.location.replace("student-login.html?next=admin-dashboard.html");
      return null;
    }
    const {data:profile,error:profileError}=await client
      .from("profiles")
      .select("full_name,role,status,account_state")
      .eq("user_id",user.id)
      .maybeSingle();
    if(profileError) throw profileError;
    if(profile?.role!=="admin"||profile.status!=="approved"||profile.account_state!=="active") {
      show("هذا القسم مخصص لمدير المنصة المعتمد والنشط فقط. سيتم تحويلك إلى المساحة المناسبة لحسابك.",true);
      window.setTimeout(()=>window.location.replace("student-space.html"),1200);
      return null;
    }
    const {data:allowed,error:adminError}=await client.rpc("is_platform_admin");
    if(adminError) throw adminError;
    if(allowed!==true) throw new Error("لم تؤكد قاعدة البيانات صلاحية المدير.");
    $("adminName").textContent=profile.full_name||"مدير المنصة";
    $("adminEmail").textContent=user.email||"";
    return true;
  }

  function renderSections() {
    const host=$("sectionsGrid");
    host.replaceChildren();
    for(const group of sections) {
      const heading=document.createElement("div");
      heading.style.gridColumn="1/-1";
      heading.style.fontSize="13px";
      heading.style.fontWeight="900";
      heading.style.color="#5f6f86";
      heading.style.margin="10px 0 -3px";
      heading.textContent=group.group;
      host.appendChild(heading);
      for(const item of group.items) {
        const card=document.createElement("a");
        card.className="section-card";
        card.href=item[3];
        const icon=document.createElement("span");
        icon.className="ico";
        icon.textContent=item[0];
        const title=document.createElement("strong");
        title.textContent=item[1];
        const desc=document.createElement("p");
        desc.textContent=item[2];
        const action=document.createElement("em");
        action.textContent="فتح القسم ←";
        card.append(icon,title,desc,action);
        host.appendChild(card);
      }
    }
  }

  function renderCourses() {
    const host=$("courseGrid");
    host.replaceChildren();
    const query=$("courseSearch").value.trim().toLowerCase();
    const filtered=courses.filter(course=>{
      const courseLessons=lessons.filter(lesson=>lesson.course_slug===course.course_slug);
      const text=[course.title,course.course_slug,course.description,...courseLessons.map(x=>x.title+" "+x.lesson_slug)].join(" ").toLowerCase();
      return !query||text.includes(query);
    });
    $("noCourses").hidden=filtered.length>0;
    for(const course of filtered) {
      const courseLessons=lessons.filter(item=>item.course_slug===course.course_slug);
      const published=courseLessons.filter(item=>item.is_published===true).length;
      const drafts=courseLessons.length-published;
      const card=document.createElement("article");
      card.className="course-card";
      card.dataset.courseSlug=course.course_slug;

      const top=document.createElement("div");
      top.className="course-top";
      const title=document.createElement("h3");
      title.textContent=course.title||course.course_slug;
      const slug=document.createElement("span");
      slug.className="slug";
      slug.textContent=course.course_slug;
      top.append(title,slug);

      const status=document.createElement("span");
      status.className="status"+(course.is_active?" active":"");
      status.textContent=course.is_active?"مقرر نشط":"مقرر غير نشط";

      const description=document.createElement("p");
      description.className="description";
      description.textContent=course.description||"لم يُضف وصف لهذا المقرر.";

      const stats=document.createElement("div");
      stats.className="course-stats";
      for(const label of [
        "عدد المحاضرات: "+courseLessons.length,
        "منشورة: "+published,
        "مسودات: "+drafts
      ]) {
        const badge=document.createElement("span");
        badge.textContent=label;
        stats.appendChild(badge);
      }

      const lessonPanel=document.createElement("div");
      lessonPanel.className="lesson-items";
      const lessonHeading=document.createElement("h4");
      lessonHeading.textContent="المحاضرات والمواد";
      lessonPanel.appendChild(lessonHeading);
      if(courseLessons.length) {
        for(const lesson of courseLessons.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))) {
          const row=document.createElement("div");
          row.className="lesson-item";
          const lessonTitle=document.createElement("span");
          lessonTitle.textContent=lesson.title||lesson.lesson_slug;
          const lessonStatus=document.createElement("small");
          lessonStatus.textContent=lesson.is_published?"منشورة":"مسودة";
          row.append(lessonTitle,lessonStatus);
          lessonPanel.appendChild(row);
        }
      } else {
        const empty=document.createElement("div");
        empty.className="no-lessons";
        empty.textContent="لا توجد محاضرات أو مواد مسجلة لهذا المقرر حتى الآن.";
        lessonPanel.appendChild(empty);
      }

      const actions=document.createElement("div");
      actions.className="course-actions";
      const manage=document.createElement("a");
      manage.className="primary";
      manage.href="admin-course-manager.html?course="+encodeURIComponent(course.course_slug);
      manage.textContent="إدارة المقرر والمحاضرات";
      const open=document.createElement("a");
      open.href="student-space.html?course="+encodeURIComponent(course.course_slug);
      open.textContent="فتح المحتوى للمدير";
      actions.append(manage,open);

      card.append(top,status,description,stats,lessonPanel,actions);
      host.appendChild(card);
    }
  }

  async function loadData() {
    if(isLoading) return;
    isLoading=true;
    $("refreshButton").disabled=true;
    show("جارٍ تحميل جميع بيانات المنصة...");
    try {
      const [
        courseResult,lessonResult,students,pending,plans,subscriptions,payments,teachers,progress,assessments,audit
      ]=await Promise.all([
        client.from("course_catalog").select("course_slug,title,description,is_active").order("title"),
        client.from("course_lessons").select("course_slug,lesson_slug,title,description,is_published,sort_order").order("course_slug").order("sort_order"),
        countValue("profiles","user_id",[["role","student"]]),
        countValue("profiles","user_id",[["status","pending"]]),
        countValue("subscription_plans","id"),
        countValue("student_subscriptions","id"),
        countValue("subscription_payments","id"),
        countValue("teacher_course_assignments","id"),
        countValue("learning_progress","id"),
        countValue("assessment_results","id"),
        countValue("membership_audit_log","id")
      ]);
      if(courseResult.error) throw courseResult.error;
      if(lessonResult.error) throw lessonResult.error;
      courses=Array.isArray(courseResult.data)?courseResult.data:[];
      lessons=Array.isArray(lessonResult.data)?lessonResult.data:[];
      const metrics=[
        ["metricCourses",courses.length],
        ["metricLessons",lessons.length],
        ["metricStudents",students],
        ["metricPending",pending],
        ["metricPlans",plans],
        ["metricSubscriptions",subscriptions],
        ["metricPayments",payments],
        ["metricTeachers",teachers],
        ["metricProgress",progress],
        ["metricAssessments",assessments],
        ["metricAudit",audit]
      ];
      for(const [id,value] of metrics) $(id).textContent=value.toLocaleString("en-US");
      renderSections();
      renderCourses();
      $("dashboardContent").hidden=false;
      show("تم التحقق من صلاحية المدير وتحميل جميع أقسام المنصة ومقرراتها ومحتوياتها. يمكنك فتح أو إدارة أي قسم من هذه الصفحة.");
    } finally {
      isLoading=false;
      $("refreshButton").disabled=false;
    }
  }

  async function boot() {
    if(!window.supabase?.createClient||
       !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||
       window.isMembershipPublicKey?.(key)!==true) {
      show("إعداد الاتصال بالمنصة غير مكتمل.",true);
      return;
    }
    client=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const allowed=await verifyAdmin();
    if(!allowed) return;
    await loadData();
    const selected=new URLSearchParams(window.location.search).get("course");
    if(selected) {
      const target=[...$("courseGrid").querySelectorAll(".course-card")]
        .find(el=>el.dataset.courseSlug===selected);
      if(target) {
        target.style.outline="3px solid #19b7a255";
        target.scrollIntoView({behavior:"smooth",block:"center"});
      }
    }
  }

  $("courseSearch").addEventListener("input",renderCourses);
  $("refreshButton").addEventListener("click",()=>loadData().catch(error=>show(error.message||"تعذر تحديث البيانات.",true)));
  $("logoutButton").addEventListener("click",async()=>{
    if(client) await client.auth.signOut();
    window.location.replace("student-login.html");
  });
  boot().catch(error=>show(error.message||"تعذر تحميل لوحة الإدارة الشاملة.",true));
})();
