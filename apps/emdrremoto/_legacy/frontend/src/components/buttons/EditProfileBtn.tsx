import React from "react"
import { editIcon } from "../../pages/home/mocks/icons"

export default class EditProfileBtn extends React.Component {
  render(){
    return(
      <button className="p-4 py-4 hover:bg-blue-50 rounded">
        {editIcon}
      </button>
    )
  }
}