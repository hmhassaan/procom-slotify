import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center max-w-2xl mx-auto p-4">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Course Extractor
        </h1>
        <p className="text-muted-foreground mt-3">
          Navigate to the page you want to visit.
        </p>
      </div>
      <nav className="mt-8">
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <li>
            <Link href="/add-schedule" passHref>
              <Button className="w-full text-lg py-6 px-8" variant="outline">
                Add Your Schedule <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/admin" passHref>
              <Button className="w-full text-lg py-6 px-8" variant="outline">
                Admin Panel <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/view-schedule" passHref>
              <Button className="w-full text-lg py-6 px-8" variant="outline">
                View Schedule <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
