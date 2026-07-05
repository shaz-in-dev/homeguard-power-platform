$(document).ready(function () {
  var form = document.getElementById("hg-form");
  if (!form) return;
  var errBox = document.getElementById("hg-error");
  var submitBtn = document.getElementById("hg-submit");

  function safeAjax(opts) {
    var d = $.Deferred();
    shell.getTokenDeferred().done(function (token) {
      opts.headers = $.extend(opts.headers || {}, { "__RequestVerificationToken": token });
      $.ajax(opts).done(function (data, ts, xhr) { d.resolve(data, ts, xhr); })
        .fail(function () { d.reject.apply(d, arguments); });
    }).fail(function () { d.reject.apply(d, arguments); });
    return d.promise();
  }

  function val(id) { return (document.getElementById(id).value || "").trim(); }
  function mark(id, bad) { document.getElementById(id).classList.toggle("hg-invalid", bad); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errBox.hidden = true;
    var name = val("f-name"), contact = val("f-contact"), email = val("f-email"),
        address = val("f-address"), type = val("f-type"), desc = val("f-desc");
    var phoneOk = /^\+?[0-9\s()\-]{10,}$/.test(contact);
    var emailOk = email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    mark("f-name", !name); mark("f-contact", !phoneOk); mark("f-email", !emailOk);
    mark("f-address", !address); mark("f-type", !type); mark("f-desc", !desc);
    if (!name || !phoneOk || !emailOk || !address || !type || !desc) {
      errBox.textContent = "Please complete all required fields with a valid phone number (and a valid email if given).";
      errBox.hidden = false; return;
    }
    submitBtn.disabled = true; submitBtn.textContent = "Submitting…";
    var d = new Date();
    var ref = "HZ-" + d.toISOString().slice(2, 10).replace(/-/g, "") + d.toTimeString().slice(0, 8).replace(/:/g, "");
    var rec = {
      hg_name: ref,
      hg_reportername: name,
      hg_reportercontact: contact + (email ? " · " + email : ""),
      hg_reporteraddress: address,
      hg_hazardtype: parseInt(type, 10),
      hg_description: desc,
      hg_reporteddate: d.toISOString(),
      hg_status: 1,
      hg_slastatus: 1
    };
    safeAjax({
      type: "POST", url: "/_api/hg_hazardcases", contentType: "application/json",
      data: JSON.stringify(rec)
    }).done(function () {
      document.getElementById("hg-ref").textContent = ref;
      form.hidden = true;
      document.getElementById("hg-success").hidden = false;
      document.getElementById("report").scrollIntoView({ behavior: "smooth" });
    }).fail(function () {
      submitBtn.disabled = false; submitBtn.textContent = "Submit report";
      errBox.textContent = "Sorry, something went wrong submitting your report. Please try again.";
      errBox.hidden = false;
    });
  });

  var again = document.getElementById("hg-again");
  if (again) again.addEventListener("click", function () {
    document.getElementById("hg-success").hidden = true;
    form.reset(); form.hidden = false;
    submitBtn.disabled = false; submitBtn.textContent = "Submit report";
  });
});
