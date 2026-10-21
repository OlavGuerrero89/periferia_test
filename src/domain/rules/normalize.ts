export function normalizeLabel(label: string): string { return label.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " "); }
