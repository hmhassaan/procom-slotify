import CourseExtractorApp from '@/components/course-extractor-app';

export default function Home() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Course Extractor
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
          Upload your university timetable in an Excel file to extract all courses. Then, create user profiles to analyze schedules and discover free time slots.
        </p>
      </header>
      <main>
        <CourseExtractorApp />
      </main>
    </div>
  );
}
