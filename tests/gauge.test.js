import test from 'node:test';
import assert from 'node:assert/strict';

class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    this.style = {};
    this.children = [];
    this.classList = {
      _classes: new Set(),
      toggle(name, force) { force ? this._classes.add(name) : this._classes.delete(name); },
      contains(name) { return this._classes.has(name); },
    };
  }
  append(...els) { this.children.push(...els); }
  remove() {}
  getBoundingClientRect() { return { width: 400, height: 4 }; }
}

globalThis.document = { createElement: (tag) => new MockElement(tag) };

const { init, update, setActive, destroy } = await import('../js/gauge.js');

test('init creates gauge DOM structure', () => {
  const container = new MockElement('div');
  init(container);

  assert.equal(container.children.length, 1);
  const gauge = container.children[0];
  assert.equal(gauge.className, 'gauge');

  const track = gauge.children[0];
  assert.equal(track.className, 'gauge-track');
  assert.equal(track.children.length, 2);
  assert.equal(track.children[0].className, 'gauge-center');
  assert.equal(track.children[1].className, 'gauge-indicator');

  destroy();
});

function extractPx(transform) {
  const m = transform.match(/calc\(-50% \+ (.+?)px\)/);
  return m ? parseFloat(m[1]) : NaN;
}

test('update positions indicator based on cents', () => {
  const container = new MockElement('div');
  init(container);
  update(25, 0.2);

  const indicator = container.children[0].children[0].children[1];
  const px = extractPx(indicator.style.transform);
  assert.ok(px > 0, `expected positive offset, got ${px}`);

  destroy();

  const container2 = new MockElement('div');
  init(container2);
  update(-25, 0.2);

  const indicator2 = container2.children[0].children[0].children[1];
  const px2 = extractPx(indicator2.style.transform);
  assert.ok(px2 < 0, `expected negative offset, got ${px2}`);

  destroy();
});

test('update with zero cents centers indicator', () => {
  const container = new MockElement('div');
  init(container);

  for (let i = 0; i < 50; i++) update(0, 0.2);

  const indicator = container.children[0].children[0].children[1];
  const px = extractPx(indicator.style.transform);
  assert.ok(Math.abs(px) < 1, `expected offset near 0, got ${px}`);

  destroy();
});

test('update fades indicator based on volume', () => {
  const container = new MockElement('div');
  init(container);

  for (let i = 0; i < 50; i++) update(0, 0);
  const indicator = container.children[0].children[0].children[1];
  assert.ok(indicator.style.opacity < 0.01, `expected low opacity, got ${indicator.style.opacity}`);

  destroy();

  const container2 = new MockElement('div');
  init(container2);

  for (let i = 0; i < 50; i++) update(0, 0.5);
  const indicator2 = container2.children[0].children[0].children[1];
  assert.ok(indicator2.style.opacity > 0.5, `expected higher opacity, got ${indicator2.style.opacity}`);

  destroy();
});

test('in-tune class toggled at ±3 cents', () => {
  const container = new MockElement('div');
  init(container);

  for (let i = 0; i < 50; i++) update(0, 0.2);
  const indicator = container.children[0].children[0].children[1];
  assert.ok(indicator.classList.contains('in-tune'), 'expected in-tune class at 0 cents');

  for (let i = 0; i < 100; i++) update(20, 0.2);
  assert.ok(!indicator.classList.contains('in-tune'), 'expected no in-tune class at 20 cents');

  destroy();
});

test('setActive toggles hidden class', () => {
  const container = new MockElement('div');
  init(container);

  const gauge = container.children[0];
  setActive(false);
  assert.ok(gauge.classList.contains('hidden'), 'expected hidden class when inactive');

  setActive(true);
  assert.ok(!gauge.classList.contains('hidden'), 'expected no hidden class when active');

  destroy();
});

test('destroy removes elements and nulls state', () => {
  const container = new MockElement('div');
  init(container);
  destroy();

  // Subsequent calls should be no-ops (no crash)
  update(10, 0.5);
  setActive(true);
});
