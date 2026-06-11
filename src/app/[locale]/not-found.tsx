import { Link } from "@/i18n/routing";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] mb-4">
        Page Not Found
      </h1>
      <p className="text-[var(--color-ink-muted-80)] max-w-md mb-8 text-lg">
        Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
      </p>
      <Link 
        href="/"
        className="apple-btn-primary"
      >
        Back to Home
      </Link>
    </div>
  );
}
