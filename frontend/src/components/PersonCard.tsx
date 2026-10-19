import { Link } from "react-router-dom";
import { formatarData } from "../format";
import type { UserCard } from "../types";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import "./PersonCard.css";

/** Uma pessoa na busca ou nas sugestões, com o botão de seguir. */
export function PersonCard({
  pessoa,
  aoMudar,
}: {
  pessoa: UserCard;
  aoMudar: (nova: UserCard) => void;
}) {
  return (
    <li className="pessoa">
      <Link to={`/u/${pessoa.id}`} className="pessoa-link">
        <Avatar id={pessoa.id} name={pessoa.name} avatarUrl={pessoa.avatarUrl} tamanho={42} />
        <span className="pessoa-textos">
          <strong>{pessoa.name}</strong>
          <span>@{pessoa.nickname}</span>
          <span className="pessoa-numeros">
            {pessoa.followers} {pessoa.followers === 1 ? "seguidor" : "seguidores"} ·{" "}
            {pessoa.catchCount} {pessoa.catchCount === 1 ? "captura" : "capturas"}
            {pessoa.lastCatchAt && ` · última em ${formatarData(pessoa.lastCatchAt)}`}
          </span>
        </span>
      </Link>
      <FollowButton
        userId={pessoa.id}
        seguindo={pessoa.isFollowedByMe}
        compacto
        aoMudar={(estado) =>
          aoMudar({ ...pessoa, isFollowedByMe: estado.following, followers: estado.followers })
        }
      />
    </li>
  );
}
