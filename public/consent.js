/*
  Cookie consent for Google Analytics (served at /consent.js on every page).

  - Google Analytics is NOT loaded until the visitor clicks "Accept".
  - "Reject" is as easy as "Accept"; either choice is remembered in this
    browser (localStorage key "cookie-consent": "granted" or "denied").
  - Any element with a data-cookie-settings attribute (the footer's
    "Cookie settings" link) reopens the banner so people can change their mind.
  - Withdrawing consent deletes the Google Analytics cookies and stops
    Analytics on the current page.

  Plain JavaScript with no dependencies, so it also works on the static area
  guide and privacy pages, which don't run the app.
*/
(function () {
  var GA_ID = "G-0CYCCTHBSZ";
  var KEY = "cookie-consent";
  var gaLoaded = false;

  function getChoice() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function saveChoice(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {
      /* private browsing: the banner will simply ask again next time */
    }
  }

  function loadAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;
    window["ga-disable-" + GA_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function removeAnalyticsCookies() {
    window["ga-disable-" + GA_ID] = true;
    var host = location.hostname;
    var domains = ["", host, "." + host, "." + host.replace(/^www\./, "")];
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0 || name === "_gid" || name === "_gat") {
        domains.forEach(function (d) {
          document.cookie =
            name + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : "");
        });
      }
    });
  }

  var banner = null;

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "cookie-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Cookie choice");
      banner.innerHTML =
        '<p class="cookie-text">We\'d like to use Google Analytics cookies to see how people use this site, so we can improve it. ' +
        'They\'re only set if you accept. <a href="/privacy">Read our privacy notice</a>.</p>' +
        '<div class="cookie-buttons">' +
        '<button type="button" class="cookie-btn" data-choice="granted">Accept analytics cookies</button>' +
        '<button type="button" class="cookie-btn" data-choice="denied">Reject analytics cookies</button>' +
        "</div>";
      banner.addEventListener("click", function (e) {
        var choice = e.target && e.target.getAttribute && e.target.getAttribute("data-choice");
        if (!choice) return;
        saveChoice(choice);
        if (choice === "granted") loadAnalytics();
        else removeAnalyticsCookies();
        hideBanner();
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
    var first = banner.querySelector("button");
    if (first && document.activeElement && document.activeElement.hasAttribute("data-cookie-settings")) first.focus();
  }

  // "Cookie settings" links anywhere on the page (including ones React adds later).
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-cookie-settings]") : null;
    if (!el) return;
    e.preventDefault();
    showBanner();
  });

  window.cookieConsent = { open: showBanner, choice: getChoice };

  var choice = getChoice();
  if (choice === "granted") {
    loadAnalytics();
  } else if (choice !== "denied") {
    if (document.body) showBanner();
    else document.addEventListener("DOMContentLoaded", showBanner);
  }
})();
