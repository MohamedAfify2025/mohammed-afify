(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const config = window.MEMBERSHIP_CONFIG || {};
const url = String(config.supabaseUrl || "").trim();
const key = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
let client = null, courses = [];

function show(text, isError = false) {
  const host = $("pageMessage");
  host.textContent = text;
  host.className = "notice" + (isError ? " error" : "");
  host.hidden = !text;
}
function isConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) &&
    window.isMembershipPublicKey?.(key) === true;
}
async function loadCourses() {
  const {data,error} = await client.from("course_catalog")
    .select("course_slug,title").eq("is_active",true).order("title");
  if(error) throw error;
  courses = Array.isArray(data) ? data : [];
  const select = $("course");
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = courses.length ? "اختر الدورة المطلوبة" : "لا توجد دورات متاحة حاليًا";
  select.appendChild(placeholder);
  for(const course of courses) {
    const option = document.createElement("option");
    option.value = course.course_slug;
    option.textContent = course.title || course.course_slug;
    select.appendChild(option);
  }
  select.disabled = courses.length === 0;
  $("submitButton").disabled = courses.length === 0;
  if(!courses.length) show("لا توجد دورات منشورة متاحة لطلب الاشتراك حاليًا. يمكنك العودة لاحقًا أو التواصل مع إدارة المنصة.",true);
}
function friendlyError(error) {
  const message = String(error?.message || "").toLowerCase();
  if(/signup.*disabled|signups not allowed|registration.*disabled/.test(message))
    return "التسجيل الذاتي غير مفعّل حاليًا. تواصل مع إدارة المنصة لتسجيلك.";
  if(/password.*(weak|short|least)|weak password/.test(message))
    return "كلمة المرور غير قوية بما يكفي. استخدم 10 أحرف على الأقل.";
  if(/rate limit|too many requests/.test(message))
    return "تم تجاوز عدد محاولات التسجيل مؤقتًا. حاول مرة أخرى لاحقًا.";
  return "تعذر إرسال الطلب الآن. راجع البيانات وحاول مرة أخرى، أو تواصل مع إدارة المنصة.";
}
async function boot() {
  if(!window.supabase?.createClient || !isConfigured()) {
    show("إعداد الاتصال بالمنصة غير مكتمل.",true); return;
  }
  client = window.supabase.createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  await loadCourses();
}
$("subscribeForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const button=$("submitButton");
  const fullName=$("fullName").value.trim().replace(/\s+/g," ");
  const email=$("email").value.trim().toLowerCase();
  const phone=$("phone").value.trim();
  const courseSlug=$("course").value;
  const password=$("password").value;
  const confirmPassword=$("confirmPassword").value;
  if(fullName.length<2||fullName.length>120) return show("اكتب الاسم بالكامل (من حرفين إلى 120 حرفًا).",true);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return show("اكتب بريدًا إلكترونيًا صحيحًا.",true);
  if(phone.length<7||phone.length>30) return show("اكتب رقم هاتف صحيحًا مع مفتاح الدولة عند الحاجة.",true);
  if(!courses.some(c=>c.course_slug===courseSlug)) return show("اختر دورة من القائمة المتاحة.",true);
  if(password.length<10) return show("كلمة المرور يجب ألا تقل عن 10 أحرف.",true);
  if(password!==confirmPassword) return show("كلمتا المرور غير متطابقتين.",true);

  button.disabled=true;
  show("جارٍ إنشاء الحساب وإرسال طلب الاشتراك...");
  try {
    const {data,error}=await client.auth.signUp({
      email,password,
      options:{data:{
        full_name:fullName,
        phone,
        requested_course:courseSlug,
        requested_role:"student"
      }}
    });
    if(error) throw error;

    if(data?.user && Array.isArray(data.user.identities) && data.user.identities.length===0) {
      show("إذا كان هذا البريد مسجلًا بالفعل، استخدم صفحة تسجيل الدخول أو استعادة كلمة المرور. وإذا لم يكن مسجلًا، راجع بريدك لأي رسالة تأكيد.");
      return;
    }
    $("subscribeForm").reset();
    show("تم إرسال طلبك. إذا كان تأكيد البريد الإلكتروني مفعّلًا، راجع بريدك وأكّد العنوان. بعد ذلك ستراجع الإدارة طلبك وتحدد الباقة والتكلفة والتفعيل. لن تظهر الدروس حتى اعتماد الاشتراك.");
  } catch(error) {
    show(friendlyError(error),true);
  } finally {
    button.disabled=false;
  }
});
boot().catch(()=>show("تعذر تحميل الدورات الآن. أعد تحميل الصفحة أو تواصل مع إدارة المنصة.",true));
})();