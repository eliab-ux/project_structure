import React, { Component } from 'react';
import Sidebar from "./sidebar"

interface IDashboardProps {
    currentComponent: any
    menuItemGroup?: Array<object>
}

export default class Dashboard extends React.Component<IDashboardProps, any> {
    constructor(props: IDashboardProps) {
        super(props)
    }
    render() {
        return (
            <div className="grid grid-cols-12">
                <div className="lg:col-span-2 col-span-0">
                    <Sidebar menuitems={this.props.menuItemGroup}></Sidebar>
                </div>
                <div className="col-span-12 lg:col-span-10">
                    <this.props.currentComponent />
                </div>
            </div>
        );
    }
}