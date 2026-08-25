import React, { ReactElement } from "react";
import { sendIcon } from "../../pages/home/mocks/icons";

interface InviteBtnProps {
  onClick?: () => void;
  ariaLabel?: string;
}

export default class InviteBtn extends React.Component<InviteBtnProps> {
  render(): ReactElement {
    const { onClick, ariaLabel = "Enviar convite" } = this.props;
    
    return (
      <button 
        className="py-4 hover:bg-blue-50 pl-3 pr-4 rounded"
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {sendIcon}
      </button>
    );
  }
}
