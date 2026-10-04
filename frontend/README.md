# HubMI app

This is the part people open. It runs on a phone through Expo, and in a browser. One screen holds the whole app: a map of the city, a sheet of reports at the bottom, and a button to add a new one.

The app does not store the reports. It asks the server described in the [backend README](../backend/README.md) and draws whatever comes back. Out of the box that server is the deployed one:

```ts
export const API_BASE_URL = 'https://hubmi-production.up.railway.app'
```

That line is in `src/api/issues.ts`. Change it to `http://<your-computer-LAN-IP>:8000` when you want the app to talk to a server running on your machine. On a phone, `localhost` means the phone, so the computer’s address on the local network is the one that works.

## What a person sees, step by step

1. The app opens on a map. The first center is Kraków’s main square (`src/constants/map.ts`). If location permission is granted, the map can follow the person. The tiles come from OpenFreeMap.
2. As soon as the map knows its corners, the app requests the reports inside that rectangle. Moving or zooming the map sends a new request. The list also refreshes about every 15 seconds, and it pauses that refresh while a vote is still being sent.
3. Pins of the same category that sit close together become one cluster with a count. Zooming into the cluster splits it. Traffic, lighting, trash, and the other categories cluster separately, so a lighting pin does not merge with a trash pin.
4. The bottom sheet starts as a short peek. It says how many problems are in view, how many were created today, and how far the nearest one is.
5. Pulling the sheet up shows the reports, most votes first. Chips filter the list by category. Tapping a row flies the map to that pin and opens the report.
6. The report page shows the photo, title, description, category, relative time, and the vote buttons. Like and dislike are toggles. Tapping the active one removes that vote.
7. The round button on the map opens the category picker: Lighting, Road, Trash, Noise, Accessibility, Animals, Vandalism, Nature, Other. Those labels are friendlier than the server’s names. Animals and Vandalism are both stored as `safety`. Nature is stored as `other`.
8. The compose sheet asks for a title, a description, up to five photos from the camera or the library, and a place. The place starts as the person’s location. “Pick on the map” hides the sheet, shows a pin in the middle of the screen, and saves wherever the map is centered when the person confirms.
9. Send uploads the first photo, then creates the report. The other photos stay on the screen during composing. The server stores a single image, so only the first one is uploaded. A short confetti burst plays, and the sheet returns home.
10. On an open report, “mark solved” asks for a note and an optional photo, then tells the server the problem is fixed. Solved reports leave the map on the next refresh.

There is no account screen. The first launch creates a random voter id and keeps it on the device, so the same phone keeps the same vote after the app restarts.

## Start it, step by step

1. Install Node.js 20 or newer. Check with `node --version`.
2. Open the `frontend` folder.
3. Install the packages:

   ```bash
   npm install
   ```

4. Start the dev server:

   ```bash
   npx expo start
   ```

5. Pick where to look at it.
   - Scan the QR code with Expo Go on a phone. Phone and computer need to be on the same network.
   - Press `a` for an Android emulator.
   - Press `i` for the iOS simulator (Mac only).
   - Press `w` for the browser.

Other scripts in `package.json`:

| Command | What it does |
| --- | --- |
| `npm start` | Same as `npx expo start`. |
| `npm run web` | Opens the browser version directly. |
| `npm run android` | Builds and runs the native Android app. |
| `npm run ios` | Builds and runs the native iOS app. |
| `npm run lint` | Runs ESLint. |

The map, camera, and photo library need a dev build once you leave Expo Go’s bundled modules. `npx expo run:android` and `npx expo run:ios` make that local build. `ios/` and `android/` are generated. Configure native behavior in `app.json`, and do not edit those folders by hand.

## How the screen is put together

The route file is small on purpose. `src/app/index.tsx` stacks four things:

1. `CityMap` draws the map and the pins.
2. `ReportLocationPin` appears only while the person is choosing a spot.
3. `MapBottomSheet` is the sliding panel. Its content changes with the current step: home list, category picker, compose form, one report, or the solve form.
4. `MapReportButton` is the button that starts a new report. It hides while another step is open.

`src/app/_layout.tsx` wraps that screen with gesture handling, React Query, the bottom-sheet provider, and the confetti overlay.

Which step is open lives in `src/stores/map-sheet-store.ts`. The stack is a short list. Home is `['home']`. Opening a report is `['home', 'issue']`. Composing is `['home', 'reports', 'compose']`. Picking a pin adds `'pick-location'`. Marking solved adds `'solve'`. Going back pops to the previous step and clears the draft when the person leaves the report flow.

The map camera lives in `src/stores/map-viewport-store.ts`: center, zoom, and the visible bounds. The issues query reads those bounds.

Votes live in `src/stores/issue-vote-store.ts`. The voter id and the current like or dislike for each report are saved on the device (a file on the phone, `localStorage` in the browser). Tapping a button updates the number on screen immediately, then sends the request. If the request fails, the screen rolls back.

## How a map refresh works

`src/hooks/use-map-issues.ts` builds the request from the visible rectangle.

1. Coordinates are rounded to four decimal places so a tiny camera nudge does not fire a new request.
2. The limit grows with zoom: 40 pins when zoomed out, then 80, 150, and 300 when zoomed in.
3. `GET /issues` returns the rows. The hook drops any row whose public vote count is below −10, matching the server’s hide rule.
4. The previous list stays on screen while the next one loads, so the pins do not blink empty on every pan.

`src/lib/cluster-issues.ts` then groups those rows. Clustering radius is 56 pixels, and clusters stop splitting after zoom 15. Two pins of the same category that would draw on top of each other get a small offset so both stay visible.

The map component has a phone version and a browser version. `city-map-view.tsx` picks the right one. The phone uses MapLibre React Native. The browser uses `maplibre-gl`.

## What the app sends to the server

All of it is in `src/api/issues.ts`.

| Action in the app | Request |
| --- | --- |
| Map moved | `GET /issues?min_lat&min_lng&max_lat&max_lng&limit` |
| Open one report | `GET /issues/{id}` |
| Like | `POST /issues/{id}/upvote` with header `X-Voter-Id` |
| Remove like | `DELETE /issues/{id}/upvote` |
| Dislike | `POST /issues/{id}/downvote` |
| Remove dislike | `DELETE /issues/{id}/downvote` |
| Attach a photo | `POST /media` as multipart, field name `file` |
| Publish the report | `POST /issues` with category, title, description, lat, lng, image url |
| Mark solved | `POST /issues/{id}/solve` with a note and an optional image url |

A photo path that starts with `/media/...` is prefixed with `API_BASE_URL` before it is shown. A full `https://` link is used as-is.

The server also has `GET /issues/similar`, which lists nearby reports so a person can vote for an existing one instead of filing a duplicate. This app does not call that address yet.

## Categories on the button vs categories in the database

| Label in the app | Stored as |
| --- | --- |
| Lighting | `lighting` |
| Road | `traffic` |
| Trash | `cleanliness` |
| Noise | `noise` |
| Accessibility | `infrastructure` |
| Animals | `safety` |
| Vandalism | `safety` |
| Nature | `other` |
| Other | `other` |

Colors and emoji for the map pins are in `src/lib/issue-categories.ts`.

## Where each file lives

- `src/app/index.tsx` — the only screen.
- `src/app/_layout.tsx` — providers around that screen.
- `src/api/issues.ts` — the server address and every request.
- `src/components/city-map-view.tsx` — chooses the phone map or the browser map.
- `src/components/map-bottom-sheet.tsx` — the sliding panel and the category list.
- `src/components/issue-feed.tsx` — the home summary and the report list.
- `src/components/issue-detail.tsx` — one report and its vote buttons.
- `src/components/report-composer.tsx` — title, photos, place, and send.
- `src/components/solve-composer.tsx` — the “this is fixed” form.
- `src/components/sheet-stack.tsx` — sliding between those steps inside the sheet.
- `src/hooks/use-map-issues.ts` — loads reports for the visible map.
- `src/hooks/use-issue.ts` — loads one report and sends votes.
- `src/lib/cluster-issues.ts` — groups nearby pins.
- `src/lib/issue-votes.ts` — the rules for how a tap changes the number on screen.
- `src/stores/` — which sheet is open, where the camera is, and how this device voted.
- `app.json` — app name, icon, and the location, camera, and photo permissions.
