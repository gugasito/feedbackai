import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, LogOut } from "lucide-react";
import jsPDF from "jspdf";
import JSZip from "jszip"; // ✅ NUEVO
import Loader from "@/components/Loader";

// ✅ NUEVO: texto plantilla con definición de indicadores
const INDICATOR_DEFINITIONS_TITLE = "Definición de los indicadores evaluados";
const INDICATOR_DEFINITIONS_BODY = `
Los indicadores utilizados en esta evaluación corresponden a dos competencias principales:

1. Fuentes de Datos Segura:
   Evalúa la capacidad del estudiante para:
   - Seleccionar fuentes de información pertinentes, actualizadas y confiables.
   - Contrastar información proveniente de diferentes fuentes.
   - Citar y referenciar adecuadamente los datos utilizados.
   - Utilizar criterios de calidad y veracidad al incorporar información en su trabajo académico.

2. Trabajo en Equipo:
   Evalúa la capacidad del estudiante para:
   - Colaborar de manera activa con sus compañeros en el logro de objetivos comunes.
   - Asumir responsabilidades dentro del equipo y cumplir con los compromisos adquiridos.
   - Mantener una comunicación respetuosa y efectiva.
   - Aportar ideas, escuchar a otros y contribuir a la resolución de conflictos.

Escala de evaluación de los indicadores (0 a 4 puntos):
- 4 puntos: Desempeño sobresaliente y consistente en el indicador.
- 3 puntos: Desempeño adecuado, con oportunidades de mejora puntual.
- 2 puntos: Desempeño insuficiente, se requiere mayor desarrollo de la competencia.
- 0 puntos: El indicador no se evidencia en el trabajo realizado.

Estos indicadores permiten orientar la retroalimentación para que el estudiante comprenda
qué aspectos específicos debe mantener, reforzar o mejorar en su desempeño académico.
`.trim();

interface DashboardProps {
  onLogout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null); // JSON de la API (informe 1)
  const [lastFilename, setLastFilename] = useState<string | null>(null); // nombre del archivo fuente

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/files/process`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Error backend:", text);
        throw new Error("Error al procesar el archivo");
      }

      const text = await response.text();
      console.log("Texto bruto desde backend:", text);

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("No se pudo parsear JSON:", e);
        toast.error("La respuesta del servidor no es un JSON válido");
        setUploading(false);
        return;
      }

      setResult(data);
      setLastFilename(file.name);
      toast.success("Archivo procesado correctamente");
      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al procesar el archivo");
    } finally {
      setUploading(false);
    }
  };

  const hasResult =
    !!result && Array.isArray(result.students) && result.students.length > 0;

  const handleDownloadPdf = () => {
    if (!hasResult) {
      toast.error("No hay resultados para descargar");
      return;
    }

    try {
      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
      });

      const marginX = 40;
      const marginY = 40;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginX * 2;

      const lineHeight = 14;
      let y = marginY;

      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";
      const filename = `${baseName}_informe1.pdf`;

      const ensureSpace = (lines: number) => {
        const needed = lines * lineHeight;
        if (y + needed > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
      };

      result.students.forEach((student: any, index: number) => {
        if (index > 0) {
          y += lineHeight * 2;
        }

        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");

        const headerText = `${student.name} (${student.matricula})`;
        const headerLines = doc.splitTextToSize(headerText, maxWidth);

        ensureSpace(headerLines.length);
        doc.text(headerLines, marginX, y);
        y += headerLines.length * lineHeight + lineHeight * 0.3;

        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");

        const fdTitle = "Fuentes de Datos Segura:";
        const fdText = student.summary_fuentes_datos_segura || "";
        const fdLines = doc.splitTextToSize(`${fdTitle}\n${fdText}`, maxWidth);
        ensureSpace(fdLines.length + 1);
        doc.text(fdLines, marginX, y);
        y += fdLines.length * lineHeight + lineHeight * 0.5;

        const teTitle = "Trabajo en Equipo:";
        const teText = student.summary_trabajo_en_equipo || "";
        const teLines = doc.splitTextToSize(`${teTitle}\n${teText}`, maxWidth);
        ensureSpace(teLines.length + 1);
        doc.text(teLines, marginX, y);
        y += teLines.length * lineHeight;

        if (student.notes && student.notes.trim() !== "") {
          const notesTitle = "Nota:";
          const notesText = student.notes.trim();
          const notesLines = doc.splitTextToSize(
            `${notesTitle} ${notesText}`,
            maxWidth
          );
          ensureSpace(notesLines.length + 1);
          doc.setFontSize(10);
          doc.setTextColor(180, 120, 0);
          doc.text(notesLines, marginX, y);
          y += notesLines.length * lineHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });

      if (result.notes && result.notes.trim() !== "") {
        y += lineHeight * 2;
        const rootNotesTitle = "Notas generales:";
        const rootNotesText = result.notes.trim();
        const rootLines = doc.splitTextToSize(rootNotesText, maxWidth);
        ensureSpace(rootLines.length + 2);

        doc.setFontSize(11);
        doc.setFont("Helvetica", "bold");
        doc.text(rootNotesTitle, marginX, y);
        y += lineHeight;
        doc.setFont("Helvetica", "normal");
        doc.text(rootLines, marginX, y);
      }

      doc.save(filename);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      toast.error("No se pudo descargar el PDF");
    }
  };

  // ✅ NUEVO: ZIP con un PDF por estudiante, cada uno con definiciones de indicadores
  const handleDownloadZipPerStudent = async () => {
    if (!hasResult) {
      toast.error("No hay resultados para descargar");
      return;
    }

    try {
      const zip = new JSZip();
      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";

      for (const student of result.students) {
        const doc = new jsPDF({
          unit: "pt",
          format: "a4",
        });

        const marginX = 40;
        const marginY = 40;

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxWidth = pageWidth - marginX * 2;

        const lineHeight = 14;
        let y = marginY;

        const ensureSpace = (lines: number) => {
          const needed = lines * lineHeight;
          if (y + needed > pageHeight - marginY) {
            doc.addPage();
            y = marginY;
          }
        };

        // Encabezado con nombre del estudiante
        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");
        const headerText = `${student.name} (${student.matricula})`;
        const headerLines = doc.splitTextToSize(headerText, maxWidth);
        ensureSpace(headerLines.length);
        doc.text(headerLines, marginX, y);
        y += headerLines.length * lineHeight + lineHeight * 0.8;

        // Resumen Fuentes de Datos Segura
        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");
        const fdTitle = "Fuentes de Datos Segura:";
        const fdText = student.summary_fuentes_datos_segura || "";
        const fdLines = doc.splitTextToSize(`${fdTitle}\n${fdText}`, maxWidth);
        ensureSpace(fdLines.length + 1);
        doc.text(fdLines, marginX, y);
        y += fdLines.length * lineHeight + lineHeight * 0.8;

        // Resumen Trabajo en Equipo
        const teTitle = "Trabajo en Equipo:";
        const teText = student.summary_trabajo_en_equipo || "";
        const teLines = doc.splitTextToSize(`${teTitle}\n${teText}`, maxWidth);
        ensureSpace(teLines.length + 1);
        doc.text(teLines, marginX, y);
        y += teLines.length * lineHeight + lineHeight * 0.8;

        // Notas individuales (si existen)
        if (student.notes && student.notes.trim() !== "") {
          const notesTitle = "Nota:";
          const notesText = student.notes.trim();
          const notesLines = doc.splitTextToSize(
            `${notesTitle} ${notesText}`,
            maxWidth
          );
          ensureSpace(notesLines.length + 1);
          doc.setFontSize(10);
          doc.setTextColor(180, 120, 0);
          doc.text(notesLines, marginX, y);
          y += notesLines.length * lineHeight + lineHeight * 0.8;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }

        // ✅ Sección fija: definición de indicadores evaluados
        y += lineHeight * 2;
        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");
        const defTitleLines = doc.splitTextToSize(
          INDICATOR_DEFINITIONS_TITLE,
          maxWidth
        );
        ensureSpace(defTitleLines.length + 1);
        doc.text(defTitleLines, marginX, y);
        y += defTitleLines.length * lineHeight + lineHeight * 0.6;

        doc.setFontSize(10);
        doc.setFont("Helvetica", "normal");
        const defBodyLines = doc.splitTextToSize(
          INDICATOR_DEFINITIONS_BODY,
          maxWidth
        );
        // Si no cabe en esta página, se va a la siguiente
        defBodyLines.forEach((line: string) => {
          ensureSpace(1);
          doc.text(line, marginX, y);
          y += lineHeight;
        });

        // Convertimos el PDF a Blob y lo agregamos al ZIP
        const pdfBlob = doc.output("blob");
        const safeName = `${student.name}`.replace(
          /[^a-zA-Z0-9_\-ÁÉÍÓÚáéíóúÑñ]+/g,
          "_"
        );
        const pdfFilename = `${baseName}_${safeName}_${student.matricula}.pdf`;

        zip.file(pdfFilename, pdfBlob);
      }

      // Generar el ZIP y disparar descarga
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = window.URL.createObjectURL(zipBlob);
      const zipName = `${baseName}_informes_por_estudiante.zip`;

      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(zipUrl);

      toast.success("ZIP generado correctamente");
    } catch (err) {
      console.error("Error al generar ZIP:", err);
      toast.error("No se pudo generar el archivo ZIP");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            FeedbackAI
          </h1>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Columna izquierda: subida de archivos */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Subir archivos
                </CardTitle>
                <CardDescription>
                  Sube archivos con nombres de alumnos, rúbricas y evaluaciones
                  para generar retroalimentación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${
                      isDragActive
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    }
                  `}
                >
                  <input {...getInputProps()} onChange={handleFileChange} />
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-4 rounded-full bg-background shadow-sm">
                      <Upload
                        className={`h-8 w-8 ${
                          isDragActive
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {isDragActive
                          ? "Suelta el archivo aquí"
                          : "Arrastra tu archivo aquí"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        o haz clic para seleccionar (.xls, .xlsx, .csv)
                      </p>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="w-full"
                >
                  {uploading ? "Procesando..." : "Procesar archivo"}
                </Button>

                {uploading && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <Loader />
                    <span className="text-xs text-muted-foreground">
                      Procesando archivo, esto puede tomar un par de minutos...
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha: resultados / informes */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informes generados</CardTitle>
                <CardDescription>
                  El archivo se procesará en 4 informes distintos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Informe 1 */}
                  <Card className="border-primary/40">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 1: Retroalimentación por estudiante
                          </CardTitle>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${
                            uploading
                              ? "bg-yellow-100 text-yellow-800"
                              : hasResult
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {uploading
                            ? "Generando..."
                            : hasResult
                            ? "Listo"
                            : "Pendiente"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <p className="text-xs text-muted-foreground">
                        {hasResult
                          ? `Estudiantes procesados: ${result.students.length}`
                          : null}
                      </p>

                      {hasResult && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                          >
                            Descargar PDF de Asignatura
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadZipPerStudent}
                          >
                            Descargar ZIP por Estudiante
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Informe 2 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 2: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Informe 3 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 3: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Informe 4 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 4: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
