function SyncCalendarsIntoOne() {
  // Midnight today
  const startTime = new Date();
  startTime.setHours(0, 0, 0, 0);
  startTime.setDate(startTime.getDate() - SYNC_DAYS_IN_PAST + 1);

  const endTime = new Date();
  endTime.setHours(0, 0, 0, 0);
  endTime.setDate(endTime.getDate() + SYNC_DAYS_IN_FUTURE + 1);

  // Delete old events
  const deleteStartTime = new Date();
  deleteStartTime.setHours(0, 0, 0, 0);
  deleteStartTime.setDate(deleteStartTime.getDate() - SYNC_DAYS_IN_PAST);

  deleteEvents(deleteStartTime, endTime);
  createEvents(startTime, endTime);
}

// Delete any old events that have been already cloned over.
// This is basically a sync w/o finding and updating. Just deleted and recreate.
function deleteEvents(startTime, endTime) {
  const sharedCalendar = CalendarApp.getCalendarById(CALENDAR_TO_MERGE_INTO);

  // Find events with the search character in the title.
  // The `.filter` method is used since the getEvents method seems to return all events at the moment. It's a safety check.
  const events = sharedCalendar
    .getEvents(startTime, endTime, { search: SEARCH_CHARACTER })
    .filter((event) => event.getTitle().includes(SEARCH_CHARACTER));

  const requestBody = events.map((e, i) => ({
    method: 'DELETE',
    endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events/${e
      .getId()
      .replace('@google.com', '')}`,
  }));

  if (requestBody && requestBody.length) {
    const result = new BatchRequest({
      useFetchAll: true,
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });

    if (result.length !== requestBody.length) {
      console.log(result);
    }

    console.log(`${result.length} deleted events.`);
  } else {
    console.log('No events to delete.');
  }
}

function createEvents(startTime, endTime) {
  let requestBody = [];

  for (let calendarName in CALENDARS_TO_MERGE) {
    const calendarId = CALENDARS_TO_MERGE[calendarName];
    const calendarToCopy = CalendarApp.getCalendarById(calendarId);

    if (!calendarToCopy) {
      console.log("Calendar not found: '%s'.", calendarId);
      continue;
    }

    // Find events
    const events = Calendar.Events.list(calendarId, {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // If nothing find, move to next calendar
    if (!(events.items && events.items.length > 0)) {
      continue;
    }

    events.items.forEach((event) => {
      if (event.transparency && event.transparency === 'transparent') {
        return;
      }

      var moon_symbol = "";
      if (event.summary.match(/new moon/i)) { moon_symbol = '\u{1F311}' }
      if (event.summary.match(/first quarter/i)) { moon_symbol = '\u{1F313}' }
      if (event.summary.match(/full moon/i)) { moon_symbol = '\u{1F315}' }
      if (event.summary.match(/last quarter/i)) { moon_symbol = '\u{1F317}' }

      var moon_time = event.summary.match(/\s+(\d+:\d+\w\w)/)

      requestBody.push({
        method: 'POST',
        endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events`,
        requestBody: {
          summary: `${SEARCH_CHARACTER}${moon_symbol} ${moon_time[1]}`,
          start: event.start,
          end: event.end,
          transparency: 'transparent',
          reminders: {
            useDefault: false,
          },
        },
      });
    });

  }

  if (requestBody && requestBody.length) {
    const result = new BatchRequest({
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });

    if (result.length !== requestBody.length) {
      console.log(result);
    }

    console.log(`${result.length} events created.`);
  } else {
    console.log('No events to create.');
  }
}
