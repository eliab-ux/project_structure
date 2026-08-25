import { MoedaIcon, UserIcon, LocalIcon, NorthIcon, PlusIcon } from "../../icons/icons";
//import Gerenciador from "../../../pages/Usuario/Perfil/gerenciador";


export const Admin = [
    {icone: NorthIcon, text: "Corridas", rota: "/Adm/Pedidos-de-corridas"},
    {icone: PlusIcon, text: "Cadastrar Bairros", rota: "/Adm/cadastro-de-bairros-x-valores"},
    {icone: LocalIcon, text: "Bairros cadastrados", rota: "/Adm/bairros-cadastrados"},
    {icone: PlusIcon, text: "Cadastrar motoboys", rota: "/Adm/cadastrar-motoboys"},
    {icone: UserIcon, text: "Relatoriós ", rota: "/Adm/relatorios"},
]

export const Usuario = [
    {icone: LocalIcon, text: "Dashboard", rota: "/dashboard"},
    {icone: UserIcon, text: "Input", rota: "/input"},
    {icone: MoedaIcon, text: "Chat", rota: "/chat"},
    {icone: MoedaIcon, text: "Home", rota: "/home"},
]

export const Motoboy = [
    {icone: UserIcon, text: "Minha conta", rota: "/motoboy/minha-conta"},
    {icone: NorthIcon, text: "Histórico de viagens", rota: "/motoboy/historico"},

]