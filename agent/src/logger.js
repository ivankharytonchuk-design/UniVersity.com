'use strict';
// Tiny leveled logger. Logs go to stderr so stdout stays clean for the JSON report.
function ts() { return new Date().toISOString(); }
function line(level, args) { console.error('[' + ts() + '] ' + level + ' ' + args.map(String).join(' ')); }

module.exports = {
  info:  function () { line('INFO ', [].slice.call(arguments)); },
  warn:  function () { line('WARN ', [].slice.call(arguments)); },
  error: function () { line('ERROR', [].slice.call(arguments)); },
  ok:    function () { line('OK   ', [].slice.call(arguments)); },
};
