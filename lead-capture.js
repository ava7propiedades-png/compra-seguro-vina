/*
 * Asesor Peterson · Compra Seguro → CRM
 * Cada vez que alguien presiona "Enviar por WhatsApp", además de abrir WhatsApp
 * se guarda el contacto en el CRM (Supabase, tabla leads, fuente "compra-seguro").
 * La clave es la "publicable" de Supabase: es pública por diseño y solo permite
 * INSERTAR contactos (no leerlos), protegido por las políticas RLS.
 */
(function () {
  var SB_URL = "https://sujyrddgluwdanqubuhz.supabase.co";
  var SB_KEY = "sb_publishable_X6kv_lffIpK_sHhah06nkg_Uhw8HgEi";
  var SOURCE = "compra-seguro";

  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }

  // 1) Agrega el campo "Tu WhatsApp" debajo del nombre (mismo estilo del formulario)
  function addPhoneField() {
    var nom = $("f_nom");
    if (!nom || $("f_tel")) return;
    var wrap = nom.parentElement;
    var clone = wrap.cloneNode(true);
    var input = clone.querySelector("input");
    var label = clone.querySelector("label");
    input.id = "f_tel";
    input.type = "tel";
    input.inputMode = "tel";
    input.autocomplete = "tel";
    input.placeholder = "Ej: +56 9 1234 5678";
    input.value = "";
    if (label) { label.htmlFor = "f_tel"; label.textContent = "Tu WhatsApp"; }
    wrap.parentNode.insertBefore(clone, wrap.nextSibling);
  }

  function objetivo() {
    var b = document.querySelector('#f_obj [aria-pressed="true"]');
    return b ? (b.getAttribute("data-v") || b.textContent || "").trim() : "";
  }

  function post(row) {
    return fetch(SB_URL + "/rest/v1/leads", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    });
  }

  // 2) Guarda el contacto en el CRM
  function saveLead() {
    var obj = objetivo();
    var zona = val("f_zona");
    var plazo = val("f_plazo");
    var pres = val("f_pres");
    var msg = val("f_msg");
    var resumen = ["Compra Seguro", obj && "Objetivo: " + obj, zona && "Zona: " + zona,
      pres && "Presupuesto/valor: " + pres, plazo && "Plazo: " + plazo, msg && "Mensaje: " + msg]
      .filter(Boolean).join(" · ").slice(0, 900);

    var base = {
      id: uuid(),
      full_name: val("f_nom") || "Sin nombre (Compra Seguro)",
      phone: val("f_tel") || "Escribió por WhatsApp",
      email: "",
      consent: true,
      source: SOURCE,
      guide_requested: resumen
    };
    var extra = {
      canal: "Web Compra Seguro",
      perfil: obj || null,
      sector_interes: zona || null,
      tags: SOURCE
    };
    var full = Object.assign({}, base, extra);

    post(full).then(function (r) {
      // Si alguna columna extra no existe, reintenta solo con lo básico
      if (r.status === 400) return post(base);
    }).catch(function () {
      try {
        var q = JSON.parse(localStorage.getItem("ap_cs_pending") || "[]");
        q.push(base);
        localStorage.setItem("ap_cs_pending", JSON.stringify(q.slice(-20)));
      } catch (e) {}
    });
  }

  // Reenvía contactos que no se pudieron guardar por falta de conexión
  function flush() {
    try {
      var q = JSON.parse(localStorage.getItem("ap_cs_pending") || "[]");
      if (!q.length) return;
      localStorage.removeItem("ap_cs_pending");
      q.forEach(function (row) { post(row).catch(function () {}); });
    } catch (e) {}
  }

  function init() {
    addPhoneField();
    var btn = $("f_send");
    if (btn) btn.addEventListener("click", saveLead, true);
    flush();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
