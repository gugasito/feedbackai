import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileText, LogOut } from "lucide-react";

interface DashboardProps {
  onLogout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

    // Asumimos que el backend devuelve un archivo (ej: CSV o Excel)
    const blob = await response.blob();

    // Nombre sugerido para descarga
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "resultado_" + file.name;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    toast.success("Archivo procesado correctamente");
    setFile(null);
  } catch (err) {
    console.error(err);
    toast.error("Ocurrió un error al procesar el archivo");
  } finally {
    setUploading(false);
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            proyecto FDE
          </h1>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Subir archivos
              </CardTitle>
              <CardDescription>
                Sube archivos con nombres de alumnos, rúbricas y evaluaciones para generar retroalimentación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Seleccionar archivo</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Archivos recientes</CardTitle>
              <CardDescription>
                Historial de archivos procesados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay archivos procesados aún
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
