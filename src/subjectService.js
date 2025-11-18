import fs from "fs";
import path from "path";
const SUBJECTS_DIR = "data/subjects/";

const SUBJECTS = new Map();
// Mapa de alias para redirecciones tras renombrar (oldId -> newId)
const ALIASES = new Map();

function loadSubject(idOrFile) {
    const file = idOrFile.endsWith(".json") ? idOrFile : idOrFile + ".json";
    return JSON.parse(fs.readFileSync(SUBJECTS_DIR + file));
}

function saveSubject(subject) {
    fs.writeFileSync(SUBJECTS_DIR + subject.id + ".json", JSON.stringify(subject, null, 2));
}

function removeSubjectFile(id) {
    try {
        fs.rmSync(SUBJECTS_DIR + id + ".json");
    } catch (_) {}
}

// --- RESETEO A DEFAULTS EN CADA INICIO ---
// Si quieres que los cambios persistan entre reinicios, comenta la llamada resetToDefaults() al final.
function ensureSubjectsDir() {
    if (!fs.existsSync(SUBJECTS_DIR)) {
        fs.mkdirSync(SUBJECTS_DIR, { recursive: true });
    }
}

function resetToDefaults(defaults) {
    ensureSubjectsDir();
    // Eliminar todos los .json existentes
    try {
        const files = fs.readdirSync(SUBJECTS_DIR);
        for (const f of files) {
            if (f.endsWith(".json")) {
                try {
                    fs.rmSync(SUBJECTS_DIR + f);
                } catch (_) {}
            }
        }
    } catch (e) {
        console.error("Error limpiando carpeta de subjects:", e);
    }
    // Re-crear desde DEFAULT_SUBJECTS
    SUBJECTS.clear();
    for (const s of defaults) {
        SUBJECTS.set(s.id, s);
        saveSubject(s);
    }
}

// Asegurar foros/asignaturas por defecto (idempotente)
const DEFAULT_SUBJECTS = [
    {
        id: "matematicas",
        name: "Matemáticas",
        code: "MAT101",
        title: "Matemáticas",
        desc: "Álgebra, cálculo, estadísticas y más.",
        description:
            "Esta asignatura abarca el estudio de álgebra, cálculo diferencial e integral, geometría, estadísticas y probabilidad. Se fomenta el razonamiento lógico, la resolución de problemas y la aplicación de las matemáticas en contextos científicos y cotidianos.",
        credits: 6,
        professor: "Dra. García",
        schedule: "Lunes 10:00-12:00",
        color: "linear-gradient(135deg,#6366f1,#06b6d4)",
        icon: "/assets/mates.png",
    },
    {
        id: "lengua",
        name: "Lengua",
        code: "LEN101",
        title: "Lengua",
        desc: "Gramática, comentario de texto y literatura.",
        description:
            "En Lengua se estudian la gramática, ortografía, expresión escrita y oral, así como análisis de textos literarios y no literarios. Se desarrolla la comprensión lectora, la creatividad y la capacidad crítica a través del estudio de distintos géneros y autores.",
        credits: 6,
        professor: "Prof. Ruiz",
        schedule: "Miércoles 14:00-16:00",
        color: "linear-gradient(135deg,#f43f5e,#f59e0b)",
        icon: "/assets/Lengua.png",
    },
    {
        id: "historia",
        name: "Historia",
        code: "HIS101",
        title: "Historia",
        desc: "Desde la Antigüedad hasta la actualidad.",
        description:
            "Historia estudia los eventos, sociedades y civilizaciones desde la Antigüedad hasta la época contemporánea. Se analizan causas y consecuencias de los hechos históricos, fomentando la comprensión crítica del pasado y su influencia en el presente.",
        credits: 6,
        professor: "Prof. Martínez",
        schedule: "Martes 11:00-13:00",
        color: "linear-gradient(135deg,#0ea5e9,#22c55e)",
        icon: "/assets/Historia.png",
    },
    {
        id: "biologia",
        name: "Biología",
        code: "BIO101",
        title: "Biología",
        desc: "Genética, ecología y biotecnología.",
        description:
            "Biología explora los principios de la vida y los organismos, incluyendo genética, ecología, biotecnología, fisiología y biodiversidad. Se abordan procesos celulares y moleculares, interacciones entre especies y adaptación al medio ambiente, combinando teoría y prácticas de laboratorio.",
        credits: 6,
        professor: "Dra. López",
        schedule: "Jueves 09:00-11:00",
        color: "linear-gradient(135deg,#22c55e,#14b8a6)",
        icon: "/assets/Biologia.png",
    },
    {
        id: "fisica",
        name: "Física",
        code: "FIS101",
        title: "Física",
        desc: "Mecánica, ondas, electricidad y magnetismo.",
        description:
            "Física estudia la naturaleza y el comportamiento de la materia y la energía. Incluye mecánica, termodinámica, ondas, óptica, electricidad y magnetismo, proporcionando herramientas para analizar fenómenos naturales mediante experimentos y resolución de problemas matemáticos.",
        credits: 6,
        professor: "Prof. Hernández",
        schedule: "Lunes 14:00-16:00",
        color: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
        icon: "/assets/Fisica.png",
    },
    {
        id: "quimica",
        name: "Química",
        code: "QUI101",
        title: "Química",
        desc: "Reacciones, orgánica y química de materiales.",
        description:
            "Química estudia la composición, estructura, propiedades y transformaciones de la materia. Se abordan reacciones químicas, química orgánica e inorgánica, análisis de materiales y laboratorio, fomentando la observación, experimentación y razonamiento científico.",
        credits: 6,
        professor: "Dra. Fernández",
        schedule: "Miércoles 10:00-12:00",
        color: "linear-gradient(135deg,#f59e0b,#ec4899)",
        icon: "/assets/quimica.png",
    },
    {
        id: "ingles",
        name: "Inglés",
        code: "ENG101",
        title: "Inglés",
        desc: "Speaking, writing, grammar & vocabulary.",
        description:
            "Inglés desarrolla habilidades de comprensión y producción oral y escrita. Se enfoca en gramática, vocabulario, expresión escrita, lectura y conversación, preparando al estudiante para comunicarse efectivamente en contextos académicos y profesionales.",
        credits: 4,
        professor: "Prof. Smith",
        schedule: "Viernes 08:00-10:00",
        color: "linear-gradient(135deg,#8b5cf6,#22c55e)",
        icon: "/assets/ingles.png",
    },
    {
        id: "informatica",
        name: "Informática",
        code: "INF101",
        title: "Informática",
        desc: "Programación, redes y desarrollo web.",
        description:
            "Informática introduce a la programación, algoritmos, estructuras de datos, desarrollo web, bases de datos y redes de computadoras. Fomenta habilidades técnicas y resolución de problemas, preparando a los estudiantes para entornos digitales y tecnológicos actuales.",
        credits: 6,
        professor: "Prof. Torres",
        schedule: "Jueves 14:00-16:00",
        color: "linear-gradient(135deg,#ec4899,#6366f1)",
        icon: "/assets/informatica.png",
    },
];

DEFAULT_SUBJECTS.forEach((def) => {
    // no-op here, we'll reset below
});

// ===== Ejecutar reset cada vez que arranque la app =====
resetToDefaults(DEFAULT_SUBJECTS);

export function getSubject(id) {
    return SUBJECTS.get(id);
}

export function getArray() {
    return Array.from(SUBJECTS.values());
}

export function exists(id) {
    return SUBJECTS.has(id);
}

function slugify(str) {
    return (
        String(str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") || "asignatura"
    );
}

// Generar id a partir del nombre, únicamente en minúsculas (sin slug)
export function idFromNameLower(name) {
    return String(name || "")
        .toLowerCase()
        .trim();
}

export function generateId(name) {
    let base = slugify(name);
    if (!SUBJECTS.has(base)) return base;
    let i = 2;
    while (SUBJECTS.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
}

function codeExists(code) {
    for (const s of SUBJECTS.values()) {
        if ((s.code || "").toUpperCase() === String(code || "").toUpperCase()) return true;
    }
    return false;
}

export function generateCode(name) {
    const letters = String(name || "SUB")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
    const prefix = (letters.slice(0, 3) || "SUB").padEnd(3, "X");
    let num = 101;
    while (codeExists(`${prefix}${num}`)) num++;
    return `${prefix}${num}`;
}

export function addSubject(subject) {
    if (SUBJECTS.get(subject.id)) {
        return 21;
    }
    SUBJECTS.set(subject.id, subject);
    saveSubject(subject);
    return 0;
}

export function deleteSubject(id) {
    // Eliminar archivo de icono asociado (si apunta a /assets/...)
    const subject = SUBJECTS.get(id);
    if (subject && subject.icon && typeof subject.icon === "string") {
        try {
            // Solo permitimos borrar archivos dentro de public/assets
            if (subject.icon.startsWith("/assets/")) {
                const fileName = path.basename(subject.icon); // evita path traversal
                const assetFile = path.join("public", "assets", fileName);
                if (fs.existsSync(assetFile)) {
                    fs.unlinkSync(assetFile);
                }
            }
        } catch (err) {
            console.error("Error deleting asset for subject", id, err);
        }
    }

    SUBJECTS.delete(id);
    removeSubjectFile(id);
}

export function modifySubject(subject) {
    if (!subject?.id) return 22;
    if (!SUBJECTS.has(subject.id)) {
        return 22;
    }
    SUBJECTS.set(subject.id, subject);
    saveSubject(subject);
    return 0;
}

export function setAlias(oldId, newId) {
    if (oldId && newId && oldId !== newId) {
        ALIASES.set(oldId, newId);
    }
}

export function getAlias(id) {
    return ALIASES.get(id) || null;
}

// Modificar usando el id de la ruta, recalculando id si cambia el nombre
export function modifySubjectById(oldId, incoming) {
    if (!oldId) return { code: 22 };
    const prev = SUBJECTS.get(oldId);
    if (!prev) return { code: 22 };

    const updated = { ...prev, ...(incoming || {}) };
    const nextName = updated.name ?? prev.name;
    const nameChanged = nextName !== prev.name;

    // Usar el nombre en minúsculas y reemplazar espacios por '_' como id
    let desiredId = (nextName || "").toLowerCase().trim().replace(/\s+/g, '_') || "asignatura";

    // Si el id deseado ya existe y no es el actual, generar variante única manteniendo '_' y añadiendo sufijo _2, _3, ...
    if (desiredId !== oldId && SUBJECTS.has(desiredId)) {
        let i = 2;
        let candidate = `${desiredId}_${i}`;
        while (SUBJECTS.has(candidate)) {
            i++;
            candidate = `${desiredId}_${i}`;
        }
        desiredId = candidate;
    }

    // Regenerar código si cambia el nombre
    if (nameChanged) {
        updated.code = generateCode(nextName);
    }

    if (desiredId !== oldId) {
        // Renombrar: asignar nuevo id, guardar, borrar archivo viejo y crear alias
        updated.id = desiredId;
        SUBJECTS.delete(oldId);
        SUBJECTS.set(desiredId, updated);
        saveSubject(updated);
        removeSubjectFile(oldId);
        setAlias(oldId, desiredId);
        return { code: 0, id: desiredId, newCode: updated.code };
    } else {
        // Sin cambio de id: solo actualizar
        updated.id = oldId;
        SUBJECTS.set(oldId, updated);
        saveSubject(updated);
        return { code: 0, id: oldId, newCode: updated.code };
    }
}
