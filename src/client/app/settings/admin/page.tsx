import AdminConfigClient from "./AdminConfigClient";

export const metadata = {
  title: "Configurações globais | Settings",
  description: "Configurações apenas para administradores",
};

export default function AdminConfigPage() {
  return <AdminConfigClient />;
}
