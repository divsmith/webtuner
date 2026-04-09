import test from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal DOM stubs ────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';

class MockElement {
  constructor(tag, ns = null) {
    this.tagName   = tag;
    this.ns        = ns;
    this.className = '';
    this.textContent = '';
    this.style     = {};
    this.children  = [];
    this.classList = {
      _classes: new Set(),
      toggle(name, force) {
        if (force === undefined) {
          this._classes.has(name) ? this._classes.delete(name) : this._classes.add(name);
        } else {
          force ? this._classes.add(name) : this._classes.delete(name);
        }
      },
      contains(name) { return this._classes.has(name); },
      add(name)      { this._classes.add(name); },
      remove(name)   { this._classes.delete(name); },
    };
    this.attributes = {};
  }
  append(...els) { this.children.push(...els); }
  appendChild(el) { this.children.push(el); return el; }
  remove() {}
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k)     { return this.attributes[k] ?? null; }
}

globalThis.document = {
  createElement:    tag  => new MockElement(tag),
  createElementNS:  (ns, tag) => new MockElement(tag, ns),
};
globalThis.requestAnimationFrame  = () => 1;
globalThis.cancelAnimationFrame   = () => {};

const { init, setTuningState, setActive, destroy } =
  await import('../js/tunerDisplay.js');

// ── Tests ────────────────────────────────────────────────────

test('init builds DOM inside container', () => {
  const container = new MockElement('div');
  init(container);

  assert.equal(container.children.length, 1, 'should append one child (td-wrap)');
  const wrap = container.children[0];
  assert.ok(wrap.className.includes('td-wrap'), 'wrapper should have td-wrap class');
  assert.ok(wrap.children.length >= 2, 'wrap should contain text area and meter area');

  destroy();
});

test('setActive hides and shows the display', () => {
  const container = new MockElement('div');
  init(container);
  const wrap = container.children[0];

  setActive(false);
  assert.ok(wrap.classList.contains('hidden'), 'should be hidden when inactive');

  setActive(true);
  assert.ok(!wrap.classList.contains('hidden'), 'should be visible when active');

  destroy();
});

test('destroy cleans up without errors', () => {
  const container = new MockElement('div');
  init(container);
  destroy();

  // Subsequent calls should be no-ops (not throw)
  assert.doesNotThrow(() => setTuningState('E', 0, 0.5, false));
  assert.doesNotThrow(() => setActive(true));
  assert.doesNotThrow(() => destroy());
});

test('setTuningState accepts valid inputs without throwing', () => {
  const container = new MockElement('div');
  init(container);

  assert.doesNotThrow(() => setTuningState('E', 0, 0.5, true));
  assert.doesNotThrow(() => setTuningState('F#', -12, 0.3, false));
  assert.doesNotThrow(() => setTuningState('Bb', 50, 0.8, false));
  assert.doesNotThrow(() => setTuningState(null, 0, 0, false));
  assert.doesNotThrow(() => setTuningState('A', NaN, 0.1, false));

  destroy();
});
