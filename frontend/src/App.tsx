import { Navigate, Route, Routes } from "react-router-dom";
import { useMe } from "./api/hooks";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { AuthPage } from "./pages/AuthPage";
import { CoursePage } from "./pages/CoursePage";
import { CourseSetup } from "./pages/CourseSetup";
import { Dashboard } from "./pages/Dashboard";
import { Library } from "./pages/Library";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { TeacherInsights } from "./pages/TeacherInsights";

function Protected({ children, teacher }: { children: JSX.Element; teacher?: boolean }) {
  const me = useMe();
  if (me.isLoading) return <div className="page"><Spinner /></div>;
  if (!me.data) return <Navigate to="/login" replace />;
  if (teacher && !["teacher", "admin"].includes(me.data.role)) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/library" element={<Library />} />
        <Route path="/courses/:id" element={<CoursePage />} />
        <Route path="/courses/:id/setup" element={<CourseSetup />} />
        <Route path="/insights" element={<Protected teacher><TeacherInsights /></Protected>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
