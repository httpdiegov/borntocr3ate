import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreatorStudioPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold font-headline text-foreground">
            Creator Studio
          </h1>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
        <div className="text-center text-muted-foreground py-12">
          <p>Bienvenido al Creator Studio.</p>
          <p className="text-sm">Nuevas herramientas de creación de contenido aparecerán aquí pronto.</p>
        </div>
      </main>
    </div>
  );
}
