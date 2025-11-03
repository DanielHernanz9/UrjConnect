const SUBJECTS_DIR = "data/users/"

const SUBJECTS = new Map();

if (fs.existsSync(SUBJECTS_DIR)) {
    // cargar de disco
} else {
    fs.mkdirSync(SUBJECTS_DIR, { recursive: true })
    [
        { 
            id: "matematicas", 
            name: "Matemáticas", 
            code: "MAT101", 
            title: "Matemáticas", 
            desc: "Álgebra, cálculo, estadísticas y más.", 
            description: "Esta asignatura abarca el estudio de álgebra, cálculo diferencial e integral, geometría, estadísticas y probabilidad. Se fomenta el razonamiento lógico, la resolución de problemas y la aplicación de las matemáticas en contextos científicos y cotidianos.", 
            credits: 6, 
            professor: "Dra. García", 
            schedule: "Lunes 10:00-12:00", 
            color: "linear-gradient(135deg,#6366f1,#06b6d4)", 
            icon: "/assets/mates.png"
        },
        { 
            id: "lengua", 
            name: "Lengua", 
            code: "LEN101", 
            title: "Lengua", 
            desc: "Gramática, comentario de texto y literatura.", 
            description: "En Lengua se estudian la gramática, ortografía, expresión escrita y oral, así como análisis de textos literarios y no literarios. Se desarrolla la comprensión lectora, la creatividad y la capacidad crítica a través del estudio de distintos géneros y autores.", 
            credits: 6, 
            professor: "Prof. Ruiz", 
            schedule: "Miércoles 14:00-16:00", 
            color: "linear-gradient(135deg,#f43f5e,#f59e0b)", 
            icon: "/assets/Lengua.png"
        },
        { 
            id: "historia", 
            name: "Historia", 
            code: "HIS101", 
            title: "Historia", 
            desc: "Desde la Antigüedad hasta la actualidad.", 
            description: "Historia estudia los eventos, sociedades y civilizaciones desde la Antigüedad hasta la época contemporánea. Se analizan causas y consecuencias de los hechos históricos, fomentando la comprensión crítica del pasado y su influencia en el presente.", 
            credits: 6, 
            professor: "Prof. Martínez", 
            schedule: "Martes 11:00-13:00", 
            color: "linear-gradient(135deg,#0ea5e9,#22c55e)", 
            icon: "/assets/Historia.png"
        },
        { 
            id: "biologia", 
            name: "Biología", 
            code: "BIO101", 
            title: "Biología", 
            desc: "Genética, ecología y biotecnología.", 
            description: "Biología explora los principios de la vida y los organismos, incluyendo genética, ecología, biotecnología, fisiología y biodiversidad. Se abordan procesos celulares y moleculares, interacciones entre especies y adaptación al medio ambiente, combinando teoría y prácticas de laboratorio.", 
            credits: 6, 
            professor: "Dra. López", 
            schedule: "Jueves 09:00-11:00", 
            color: "linear-gradient(135deg,#22c55e,#14b8a6)", 
            icon: "/assets/Biologia.png"
        },
        { 
            id: "fisica", 
            name: "Física", 
            code: "FIS101", 
            title: "Física", 
            desc: "Mecánica, ondas, electricidad y magnetismo.", 
            description: "Física estudia la naturaleza y el comportamiento de la materia y la energía. Incluye mecánica, termodinámica, ondas, óptica, electricidad y magnetismo, proporcionando herramientas para analizar fenómenos naturales mediante experimentos y resolución de problemas matemáticos.", 
            credits: 6, 
            professor: "Prof. Hernández", 
            schedule: "Lunes 14:00-16:00", 
            color: "linear-gradient(135deg,#06b6d4,#8b5cf6)", 
            icon: "/assets/Fisica.png"
        },
        { 
            id: "quimica", 
            name: "Química", 
            code: "QUI101", 
            title: "Química", 
            desc: "Reacciones, orgánica y química de materiales.", 
            description: "Química estudia la composición, estructura, propiedades y transformaciones de la materia. Se abordan reacciones químicas, química orgánica e inorgánica, análisis de materiales y laboratorio, fomentando la observación, experimentación y razonamiento científico.", 
            credits: 6, 
            professor: "Dra. Fernández", 
            schedule: "Miércoles 10:00-12:00", 
            color: "linear-gradient(135deg,#f59e0b,#ec4899)", 
            icon: "/assets/quimica.png"
        },
        { 
            id: "ingles", 
            name: "Inglés", 
            code: "ENG101", 
            title: "Inglés", 
            desc: "Speaking, writing, grammar & vocabulary.", 
            description: "Inglés desarrolla habilidades de comprensión y producción oral y escrita. Se enfoca en gramática, vocabulario, expresión escrita, lectura y conversación, preparando al estudiante para comunicarse efectivamente en contextos académicos y profesionales.", 
            credits: 4, 
            professor: "Prof. Smith", 
            schedule: "Viernes 08:00-10:00", 
            color: "linear-gradient(135deg,#8b5cf6,#22c55e)", 
            icon: "/assets/ingles.png"
        },
        { 
            id: "informatica", 
            name: "Informática", 
            code: "INF101", 
            title: "Informática", 
            desc: "Programación, redes y desarrollo web.", 
            description: "Informática introduce a la programación, algoritmos, estructuras de datos, desarrollo web, bases de datos y redes de computadoras. Fomenta habilidades técnicas y resolución de problemas, preparando a los estudiantes para entornos digitales y tecnológicos actuales.", 
            credits: 6, 
            professor: "Prof. Torres", 
            schedule: "Jueves 14:00-16:00", 
            color: "linear-gradient(135deg,#ec4899,#6366f1)", 
            icon: "/assets/informatica.png"
        }
    ].forEach(element => {
        addSubject(element)
    });
}

export function getSubject(id) {
    return SUBJECTS.get(id);
}

export function getArray() {
    return Array.from(SUBJECTS.values());
}

export function addSubject(subject) {
    if (SUBJECTS.subject.id) {
        return 21;
    }
    SUBJECTS.set(subject.id, subject)
    return 0;
}

export function deleteSubject(id) {
    SUBJECTS.delete(id);
}

export function modifySubject(id, subject) {
    if (!SUBJECTS.id) {
        return 22;
    }
    deleteSubject(id);
    SUBJECTS.set(subject.id, subject);
}