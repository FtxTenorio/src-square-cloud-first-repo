import PreferencesClient from "./PreferencesClient";

export const metadata = {
  title: "Minhas preferências | Settings",
  description: "Preferências do usuário (timezone, etc.)",
};

export default function PreferencesPage() {
  return <PreferencesClient />;
}
