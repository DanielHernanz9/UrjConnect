import fs from "fs";
import path from "path";

const CALENDAR_DIR = path.join("data", "calendars");

function ensureCalendarDir() {
    if (!fs.existsSync(CALENDAR_DIR)) {
        fs.mkdirSync(CALENDAR_DIR, { recursive: true });
    }
}

function safeSubjectId(subjectId) {
    return (
        String(subjectId || "")
            .trim()
            .replace(/[^a-zA-Z0-9._-]+/g, "-") || "subject"
    );
}

function fileFor(subjectId) {
    ensureCalendarDir();
    return path.join(CALENDAR_DIR, `${safeSubjectId(subjectId)}.json`);
}

function generateEventId(subjectId) {
    return `${safeSubjectId(subjectId)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDate(input) {
    if (!input) return null;
    const str = String(input).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
        return null;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function createDefaultCalendar(subjectId) {
    const now = new Date().toISOString();
    return {
        subjectId: String(subjectId || "").trim() || "subject",
        updatedAt: now,
        events: [],
    };
}

function readCalendar(subjectId) {
    const file = fileFor(subjectId);
    let dirty = false;
    let data;
    if (!fs.existsSync(file)) {
        data = createDefaultCalendar(subjectId);
        dirty = true;
    } else {
        try {
            const raw = fs.readFileSync(file, "utf8");
            data = JSON.parse(raw) || {};
        } catch (e) {
            data = createDefaultCalendar(subjectId);
            dirty = true;
        }
    }

    const markDirty = () => {
        dirty = true;
    };

    data.subjectId = String(data.subjectId || subjectId || "").trim() || "subject";
    if (!data.updatedAt) {
        data.updatedAt = new Date().toISOString();
        markDirty();
    }

    if (!Array.isArray(data.events)) {
        data.events = [];
        markDirty();
    }

    const normalizedEvents = [];
    for (const evt of data.events) {
        const normalized = normalizeEvent(evt, data.subjectId, markDirty);
        if (normalized) normalizedEvents.push(normalized);
        else markDirty();
    }

    normalizedEvents.sort((a, b) => {
        if (a.date === b.date) {
            return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
        }
        return a.date.localeCompare(b.date);
    });

    data.events = normalizedEvents;

    if (dirty) {
        writeCalendar(subjectId, data);
    }

    return data;
}

function normalizeEvent(event, subjectId, markDirty) {
    if (!event) return null;
    const title = String(event.title || "").trim();
    if (!title) return null;
    const date = normalizeDate(event.date);
    if (!date) return null;
    const description = event.description ? String(event.description).trim() : "";

    let id = event.id ? String(event.id).trim() : "";
    if (!id || !/^[a-zA-Z0-9._-]{6,}$/i.test(id)) {
        id = generateEventId(subjectId);
        markDirty();
    }

    let createdAt = event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString();
    if (!event.createdAt) markDirty();
    let updatedAt = event.updatedAt ? new Date(event.updatedAt).toISOString() : createdAt;
    if (!event.updatedAt) markDirty();

    const trimmedTitle = title.slice(0, 180);
    if (trimmedTitle !== title) markDirty();
    const trimmedDescription = description.slice(0, 600);
    if (trimmedDescription !== description) markDirty();

    return {
        id,
        date,
        title: trimmedTitle,
        description: trimmedDescription,
        createdAt,
        updatedAt,
    };
}

function writeCalendar(subjectId, data) {
    const file = fileFor(subjectId);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function getCalendar(subjectId) {
    return readCalendar(subjectId);
}

export function addEvent(subjectId, payload) {
    const calendar = readCalendar(subjectId);
    const now = new Date().toISOString();

    const date = normalizeDate(payload?.date);
    if (!date) {
        const err = new Error("Fecha inválida");
        err.code = "INVALID_DATE";
        throw err;
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    if (date < todayIso) {
        const err = new Error("No se pueden crear eventos en fechas pasadas");
        err.code = "DATE_IN_PAST";
        throw err;
    }
    const title = String(payload?.title || "").trim();
    if (!title) {
        const err = new Error("El título es obligatorio");
        err.code = "TITLE_REQUIRED";
        throw err;
    }
    const description = payload?.description ? String(payload.description).trim() : "";

    const event = {
        id: generateEventId(subjectId),
        date,
        title: title.slice(0, 180),
        description: description.slice(0, 600),
        createdAt: now,
        updatedAt: now,
    };

    calendar.events.push(event);
    calendar.updatedAt = now;
    calendar.events.sort((a, b) => {
        if (a.date === b.date) {
            return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
        }
        return a.date.localeCompare(b.date);
    });

    writeCalendar(subjectId, calendar);
    return event;
}

export function removeEvent(subjectId, eventId) {
    if (!eventId) return null;
    const calendar = readCalendar(subjectId);
    const idx = calendar.events.findIndex((evt) => evt.id === eventId);
    if (idx === -1) {
        return null;
    }
    const [removed] = calendar.events.splice(idx, 1);
    calendar.updatedAt = new Date().toISOString();
    writeCalendar(subjectId, calendar);
    return removed;
}
