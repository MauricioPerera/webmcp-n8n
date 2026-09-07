/**
 * n8n-kdd: Client-side Workflow Scheduler
 * Manages timed executions, periodic intervals, specific date triggers,
 * and standard 5-field cron expressions directly in the browser.
 */

export function parseCronField(field, min, max) {
  const values = new Set();
  if (!field) return values;

  const parts = field.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (trimmed.startsWith('*/')) {
      const step = parseInt(trimmed.slice(2), 10);
      if (!isNaN(step) && step > 0) {
        for (let i = min; i <= max; i += step) values.add(i);
      }
    } else if (trimmed.includes('-')) {
      let [rangePart, stepPart] = trimmed.split('/');
      let [startStr, endStr] = rangePart.split('-');
      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);
      let step = stepPart ? parseInt(stepPart, 10) : 1;

      if (!isNaN(start) && !isNaN(end) && step > 0) {
        for (let i = start; i <= end; i += step) {
          if (i >= min && i <= max) values.add(i);
        }
      }
    } else {
      const val = parseInt(trimmed, 10);
      if (!isNaN(val) && val >= min && val <= max) {
        values.add(val);
      }
    }
  }
  return values;
}

export function matchesCron(cronExpr, date = new Date()) {
  if (!cronExpr || typeof cronExpr !== 'string') return false;
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minPart, hrPart, domPart, monPart, dowPart] = parts;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  const validMinutes = parseCronField(minPart, 0, 59);
  const validHours = parseCronField(hrPart, 0, 23);
  const validDom = parseCronField(domPart, 1, 31);
  const validMonth = parseCronField(monPart, 1, 12);
  const validDow = parseCronField(dowPart, 0, 6);

  return validMinutes.has(minute) &&
         validHours.has(hour) &&
         validDom.has(dom) &&
         validMonth.has(month) &&
         validDow.has(dow);
}

export function calculateDateDelay(targetDateStr) {
  if (!targetDateStr) return -1;
  const target = new Date(targetDateStr).getTime();
  if (isNaN(target)) return -1;
  return target - Date.now();
}

export function calculateIntervalSeconds(value, unit = 'seconds') {
  const val = parseInt(value, 10);
  if (isNaN(val) || val <= 0) return 10;
  switch (unit) {
    case 'minutes': return val * 60;
    case 'hours': return val * 3600;
    case 'days': return val * 86400;
    case 'seconds':
    default:
      return val;
  }
}

export class ClientScheduler {
  constructor(executeCallback) {
    this.executeCallback = executeCallback || (() => {});
    this.timers = [];
    this.cronInterval = null;
    this.isActive = false;
    this.lastCronKey = '';
  }

  start(workflow) {
    this.stop();
    this.isActive = true;

    if (!workflow || !Array.isArray(workflow.nodes)) return;

    const scheduleNodes = workflow.nodes.filter(n => n.type === 'schedule_trigger' && !n.disabled);
    if (scheduleNodes.length === 0) return;

    for (const node of scheduleNodes) {
      const p = node.params || {};
      const mode = p.mode || 'interval';

      if (p.triggerOnLoad !== false) {
        const loadTimer = setTimeout(() => {
          if (this.isActive) {
            this.executeCallback(node, { triggerType: 'schedule', reason: 'triggerOnLoad' });
          }
        }, 300);
        this.timers.push(loadTimer);
      }

      if (mode === 'interval') {
        const sec = calculateIntervalSeconds(p.intervalValue || p.intervalSeconds || 10, p.intervalUnit || 'seconds');
        const intervalTimer = setInterval(() => {
          if (this.isActive) {
            this.executeCallback(node, {
              triggerType: 'schedule',
              reason: 'interval',
              intervalSeconds: sec,
              firedAt: new Date().toISOString()
            });
          }
        }, sec * 1000);
        this.timers.push(intervalTimer);

      } else if (mode === 'specific_date') {
        const delay = calculateDateDelay(p.specificDate);
        if (delay > 0) {
          const dateTimer = setTimeout(() => {
            if (this.isActive) {
              this.executeCallback(node, {
                triggerType: 'schedule',
                reason: 'specific_date',
                targetDate: p.specificDate,
                firedAt: new Date().toISOString()
              });
            }
          }, delay);
          this.timers.push(dateTimer);
        }

      } else if (mode === 'cron') {
        const cronExpr = p.cronExpression || '*/5 * * * *';
        if (!this.cronInterval) {
          this.cronInterval = setInterval(() => {
            if (!this.isActive) return;
            const now = new Date();
            const minuteKey = String(now.getFullYear()) + '-' + String(now.getMonth()) + '-' + String(now.getDate()) + ' ' + String(now.getHours()) + ':' + String(now.getMinutes());
            if (this.lastCronKey !== minuteKey) {
              if (matchesCron(cronExpr, now)) {
                this.lastCronKey = minuteKey;
                this.executeCallback(node, {
                  triggerType: 'schedule',
                  reason: 'cron',
                  cronExpression: cronExpr,
                  firedAt: now.toISOString()
                });
              }
            }
          }, 10000);
        }
      }
    }
  }

  stop() {
    this.isActive = false;
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers = [];
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = null;
    }
    this.lastCronKey = '';
  }
}
