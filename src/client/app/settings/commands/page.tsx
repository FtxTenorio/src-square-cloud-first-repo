import CommandsClient from "./CommandsClient";

export const metadata = {
  title: "Commands | Settings",
  description: "Manage slash commands and Discord sync",
};

export default function CommandsPage() {
  return <CommandsClient />;
}
