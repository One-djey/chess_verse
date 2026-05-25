import { useNavigate } from "react-router-dom";
import GameModeSelect from "./GameModeSelect";

export default function GameModes() {
  const navigate = useNavigate();
  return (
    <GameModeSelect
      playType="local"
      onSelect={(mode) => navigate(`/game/${mode.id}`)}
    />
  );
}
