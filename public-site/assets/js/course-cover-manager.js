(() => {
  "use strict";

  const BUCKET = "public-course-assets";
  const FILE_NAME = "hero-image";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const config = window.MEMBERSHIP_CONFIG || {};
  const projectUrl = String(config.supabaseUrl || "").trim();
  const publicKey = String(config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
  let clientPromise = null;
  let adminPromise = null;

  function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        if (!window.supabase?.createClient ||
            !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl) ||
            window.isMembershipPublicKey?.(publicKey) !== true) {
          throw new Error("إعداد الاتصال بمنصة الدورات غير مكتمل.");
        }
        return window.supabase.createClient(projectUrl, publicKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      })();
    }
    return clientPromise;
  }

  async function isPlatformAdmin() {
    if (!adminPromise) {
      adminPromise = (async () => {
        const db = await getClient();
        const { data: userData, error: userError } = await db.auth.getUser();
        if (userError) throw userError;
        const user = userData?.user;
        if (!user) return false;

        const { data: profile, error: profileError } = await db
          .from("profiles")
          .select("role,status,account_state")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.role !== "admin" ||
            profile.status !== "approved" ||
            profile.account_state !== "active") return false;

        const { data: allowed, error: adminError } = await db.rpc("is_platform_admin");
        if (adminError) throw adminError;
        return allowed === true;
      })().catch((error) => {
        console.warn("Course cover administrator check failed:", error?.message || error);
        return false;
      });
    }
    return adminPromise;
  }

  function safeSlug(value) {
    const slug = String(value || "").trim();
    return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) ? slug : "";
  }

  function setStatus(panel, message, isError = false) {
    const node = panel?.querySelector("[data-course-cover-status]");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", !!isError);
  }

  function revealCover(root, image, visual, slot, fallback, url) {
    image.onload = () => {
      image.hidden = false;
      if (visual) visual.hidden = false;
      if (fallback) fallback.hidden = true;
      if (slot) slot.classList.add("has-course-cover");
      root.classList.add("has-course-cover");
    };
    image.onerror = () => {
      image.hidden = true;
      if (visual) visual.hidden = true;
      if (fallback) fallback.hidden = false;
      if (slot) slot.classList.remove("has-course-cover");
      root.classList.remove("has-course-cover");
    };
    image.src = url;
  }

  async function loadExistingCover(root, slug, elements) {
    const db = await getClient();
    const { data: files, error } = await db.storage.from(BUCKET).list(slug, {
      limit: 100,
      search: FILE_NAME
    });
    if (error) throw error;
    const file = (Array.isArray(files) ? files : []).find((item) => item.name === FILE_NAME);
    if (!file) return;

    const { data } = db.storage.from(BUCKET).getPublicUrl(slug + "/" + FILE_NAME);
    if (!data?.publicUrl) return;
    const version = file.updated_at ? Date.parse(file.updated_at) : Date.now();
    revealCover(root, elements.image, elements.visual, elements.slot, elements.fallback,
      data.publicUrl + "?v=" + (Number.isFinite(version) ? version : Date.now()));
  }

  function setupUpload(root, slug, elements) {
    const panel = elements.panel;
    const input = elements.input;
    const label = elements.label;
    if (!panel || !input || !label) return;

    panel.hidden = false;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.has(file.type)) {
        setStatus(panel, "اختر صورة PNG أو JPG أو WebP.", true);
        input.value = "";
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setStatus(panel, "حجم الصورة يجب ألا يتجاوز 10 ميجابايت.", true);
        input.value = "";
        return;
      }

      label.classList.add("is-busy");
      label.textContent = "جارٍ رفع الغلاف…";
      input.disabled = true;
      setStatus(panel, "يتم رفع الصورة إلى مكتبة أغلفة الدورات…");

      try {
        const db = await getClient();
        const path = slug + "/" + FILE_NAME;
        const { error } = await db.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          cacheControl: "300",
          upsert: true
        });
        if (error) throw error;

        const { data } = db.storage.from(BUCKET).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error("تم الرفع لكن تعذر الحصول على رابط الصورة.");
        revealCover(root, elements.image, elements.visual, elements.slot, elements.fallback,
          data.publicUrl + "?v=" + Date.now());
        setStatus(panel, "تم تحديث غلاف هذه الدورة بنجاح. سيظهر للزوار والمتدربين.");
      } catch (error) {
        setStatus(panel, error?.message || "تعذر رفع صورة الغلاف.", true);
      } finally {
        label.classList.remove("is-busy");
        label.textContent = "رفع / تغيير صورة الغلاف";
        input.disabled = false;
        input.value = "";
      }
    });
  }

  async function init(root, requestedSlug, options = {}) {
    if (!root) return;
    const storedSlug = root.dataset.courseCover === "dynamic"
      ? new URLSearchParams(window.location.search).get("course")
      : root.dataset.courseCover;
    const slug = safeSlug(requestedSlug || storedSlug);
    if (!slug) return;
    root.dataset.courseCover = slug;
    if (root.dataset.coverManagerReady === "1") return;
    root.dataset.coverManagerReady = "1";

    const elements = {
      image: root.querySelector("[data-course-cover-image]"),
      visual: root.querySelector("[data-course-cover-visual]"),
      slot: root.querySelector("[data-course-cover-slot]"),
      fallback: root.querySelector("[data-course-cover-fallback]"),
      panel: root.querySelector("[data-course-cover-admin]") ||
        document.querySelector('[data-course-cover-admin="' + slug + '"]'),
      input: root.querySelector("[data-course-cover-file]") ||
        document.querySelector('[data-course-cover-file="' + slug + '"]'),
      label: root.querySelector("[data-course-cover-upload-label]") ||
        document.querySelector('[data-course-cover-upload-label="' + slug + '"]')
    };

    if (elements.image) {
      loadExistingCover(root, slug, elements).catch((error) => {
        console.warn("Course cover could not be loaded:", error?.message || error);
      });
    }

    const mayShowUpload = options.allowAdminUpload !== false;
    if (mayShowUpload && elements.panel && await isPlatformAdmin()) {
      setupUpload(root, slug, elements);
    }
  }

  window.CourseCoverManager = { init };
  document.dispatchEvent(new CustomEvent("course-cover-manager-ready"));
  document.querySelectorAll("[data-course-cover]").forEach((root) => {
    const slug = root.dataset.courseCover;
    if (slug && slug !== "dynamic") init(root, slug).catch((error) => {
      console.warn("Course cover setup failed:", error?.message || error);
    });
  });
})();
