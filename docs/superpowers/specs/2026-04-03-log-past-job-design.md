# Log Past Job — Design Spec
Date: 2026-04-03

## Overview

A secondary "Log Past Job" button on the homepage lets the user record completed jobs for documentation. The existing job form (`/job.html`) is reused via a `?past=true` URL parameter. When in past mode the form gains a date field and hides the notifications section. The server skips email/SMS for past jobs.

## Homepage Change

A small secondary button is added below the main dashboard grid linking to `/job.html?past=true`. It is visually de-emphasized (smaller, muted style) to signal one-time/occasional use.

## Job Form Changes (`public/job.html` + `public/js/job.js`)

On page load, `job.js` checks `new URLSearchParams(location.search).get('past')`.

When `past=true`:
- A **Job Date** date picker (required) is inserted near the top of the form, before the customer section. It defaults to today but can be set to any past date.
- The **Notifications section** (send SMS checkbox, follow-up reminders) is hidden entirely via `display:none`.
- The page title changes to "Log Past Job" so it's clear which mode is active.
- The submit button label changes to "Save Past Job".

When `past` is absent (normal flow), nothing changes.

## Server Changes (`routes/jobs.js`)

The POST `/api/jobs` handler accepts an optional `job_date` field in the request body. When present, it is used as the `date` value on the `jobs` row instead of the database default (today). Email and SMS sending are skipped entirely when `job_date` is provided.

No schema changes are needed — the `date` column already exists on the `jobs` table.

## What Does Not Change

- The database schema
- All existing job form behavior for normal (non-past) jobs
- Reports — past jobs appear in date-range reports using their recorded date
- Customer lookup, bike selection, line items, totals — all identical
