// The home page used to be the Manchester finder, so links shared from it look
// like /?rent=1200&life=family. Send those on to /manchester with the same
// settings. A plain visit to / (or one with only tracking tags such as
// ?utm_source=...) stays on the city chooser.
(function () {
  var params = new URLSearchParams(window.location.search);
  var settings = Array.from(params.keys()).filter(function (key) {
    return !/^(utm_|gclid$|fbclid$|msclkid$)/.test(key);
  });
  if (settings.length) window.location.replace("/manchester" + window.location.search + window.location.hash);
})();
