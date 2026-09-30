import { Workspace } from "@/components/workspace";
import { StoreProvider } from "@/state/store";

export default function Page() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
