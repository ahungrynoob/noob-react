/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import MAX_SIGNED_31_BIT_INT from './maxSigned31BitInt';

import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  IdlePriority,
} from './SchedulerWithReactIntegration';

export const NoWork = 0;
export const Never = 1;
export const Sync = MAX_SIGNED_31_BIT_INT;
export const Batched = Sync - 1;

const UNIT_SIZE = 10;
const MAGIC_NUMBER_OFFSET = Batched - 1;

// 1 unit of expiration time represents 10ms.
export function msToExpirationTime(ms) {
  // Always add an offset so that we don't clash with the magic number for NoWork.
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0);
}

export function expirationTimeToMs(expirationTime) {
  return (MAGIC_NUMBER_OFFSET - expirationTime) * UNIT_SIZE;
}

function ceiling(num, precision) {
  return (((num / precision) | 0) + 1) * precision;
}

function computeExpirationBucket(
  currentTime,
  expirationInMs,
  bucketSizeMs,
) {
  return (
    MAGIC_NUMBER_OFFSET -
    ceiling(
      MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
      bucketSizeMs / UNIT_SIZE,
    )
  );
}

// TODO: This corresponds to Scheduler's NormalPriority, not LowPriority. Update
// the names to reflect.
export const LOW_PRIORITY_EXPIRATION = 5000;
export const LOW_PRIORITY_BATCH_SIZE = 250;

export function computeAsyncExpiration(
  currentTime,
) {
  return computeExpirationBucket(
    currentTime,
    LOW_PRIORITY_EXPIRATION,
    LOW_PRIORITY_BATCH_SIZE,
  );
}

export function computeSuspenseExpiration(
  currentTime,
  timeoutMs,
) {
  // TODO: Should we warn if timeoutMs is lower than the normal pri expiration time?
  return computeExpirationBucket(
    currentTime,
    timeoutMs,
    LOW_PRIORITY_BATCH_SIZE,
  );
}

// We intentionally set a higher expiration time for interactive updates in
// dev than in production.
//
// If the main thread is being blocked so long that you hit the expiration,
// it's a problem that could be solved with better scheduling.
//
// People will be more likely to notice this and fix it with the long
// expiration time in development.
//
// In production we opt for better UX at the risk of masking scheduling
// problems, by expiring fast.
export const HIGH_PRIORITY_EXPIRATION = __DEV__ ? 500 : 150;
export const HIGH_PRIORITY_BATCH_SIZE = 100;

export function computeInteractiveExpiration(currentTime) {
  return computeExpirationBucket(
    currentTime,
    HIGH_PRIORITY_EXPIRATION,
    HIGH_PRIORITY_BATCH_SIZE,
  );
}

export function inferPriorityFromExpirationTime(
  currentTime,
  expirationTime,
) {
  if (expirationTime === Sync) {
    return ImmediatePriority;
  }
  if (expirationTime === Never) {
    return IdlePriority;
  }
  const msUntil =
    expirationTimeToMs(expirationTime) - expirationTimeToMs(currentTime);
  if (msUntil <= 0) {
    return ImmediatePriority;
  }
  if (msUntil <= HIGH_PRIORITY_EXPIRATION + HIGH_PRIORITY_BATCH_SIZE) {
    return UserBlockingPriority;
  }
  if (msUntil <= LOW_PRIORITY_EXPIRATION + LOW_PRIORITY_BATCH_SIZE) {
    return NormalPriority;
  }

  // TODO: Handle LowPriority

  // Assume anything lower has idle priority
  return IdlePriority;
}