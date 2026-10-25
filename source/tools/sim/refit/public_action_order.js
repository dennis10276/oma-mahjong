'use strict';
const assert = require('assert/strict');

function publicActionOrder(actions, salt = 1) {
  assert(Number.isInteger(salt) && salt > 0 && salt <= 0x7fffffff);
  assert(actions.every(action => Number.isInteger(action.index) && action.index >= 0));
  if (salt === 1) return actions;
  const priority = index => {
    let value = (index + Math.imul(salt, 0x9e3779b1)) >>> 0;
    value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
    value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
    return (value ^ value >>> 16) >>> 0;
  };
  return actions.slice().sort((left, right) => priority(left.index) - priority(right.index) || left.index - right.index);
}

module.exports = { publicActionOrder };
