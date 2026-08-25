import React from "react";
import Modal from "../../components/modals/modal";
import AddPaciente from "./forms/addPaciente";
import BtnAddPaciente from "./forms/btnAddPaciente";
import BtnExit  from "./forms/btnExit";
import NavbarMenu from "./navbar/navbar";
import TableMenu from "./table/homeTable";
import "./homepage.css"

export default class HomePage extends React.Component<any, any> {
  render() {
    return (
      <div className="homepage">
        <NavbarMenu></NavbarMenu>
        <div className="flex justify-end mt-10 mr-5">
          <Modal content={AddPaciente} openModalComponent={BtnAddPaciente} />
          <BtnExit/>
        </div>
        <div>
        </div>
        <TableMenu></TableMenu>
      </div>
    );
  }
}
