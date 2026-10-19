import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { useRoute } from './lib/router';
import type { Route } from './lib/router';
import { HomePage } from './pages/HomePage';
import { IssuePage } from './pages/IssuePage';
import { ArchivePage } from './pages/ArchivePage';
import { CategoryPage } from './pages/CategoryPage';
import { ReviewPage } from './pages/ReviewPage';
import { SearchPage } from './pages/SearchPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'issue':
      return <IssuePage date={route.date} />;
    case 'archive':
      return <ArchivePage />;
    case 'category':
      return <CategoryPage domain={route.domain} />;
    case 'review':
      return <ReviewPage />;
    case 'search':
      return <SearchPage key={route.q} initialQuery={route.q} />;
    case 'about':
      return <AboutPage />;
    default:
      return <NotFoundPage path={route.path} />;
  }
}

export default function App() {
  const route = useRoute();

  return (
    <>
      <Header route={route} />
      <main className="page-main">{renderRoute(route)}</main>
      <Footer />
    </>
  );
}
