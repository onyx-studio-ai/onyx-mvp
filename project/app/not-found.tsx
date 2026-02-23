import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-8xl font-bold text-gray-800">404</p>
        <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
