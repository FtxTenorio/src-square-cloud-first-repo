import ServerConfigClient from "./ServerConfigClient";

export const metadata = {
  title: "Servidor | Settings",
  description: "Configurações do servidor (guild)",
};

export default function ServerConfigPage() {
  return <ServerConfigClient />;
}
