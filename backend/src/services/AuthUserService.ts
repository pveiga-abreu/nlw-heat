import axios from "axios";
import { sign } from "jsonwebtoken";

import prismaClient from "../prisma";

interface IAccessTokenResponse {
    access_token: string
}

interface IUserResponse {
    avatar_url: string,
    login: string,
    id: number,
    name: string
}

class AuthUserService {
    async execute(code: string) {
        const url = 'https://github.com/login/oauth/access_token';

        // Recuperar access_token do GitHub
        const { data: accessTokenResponse } = await axios.post<IAccessTokenResponse>(url, null, {
            params: {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code
            },
            headers: {
                "Accept": "application/json"
            }
        });

        // Recuperar dados do usuário
        const response = await axios.get<IUserResponse>('https://api.github.com/user', {
            headers: {
                authorization: `Bearer ${accessTokenResponse.access_token}`
            }
        });

        const { login, id, avatar_url, name } = response.data;

        // Verificar se o usuário existe
            // SIM - Gera Token
            // NÃO - Cria no DB, e gera token
        let user = await prismaClient.user.findFirst({
            where: {
                github_id: id
            }
        });

        if (!user) {
            user = await prismaClient.user.create({
                data: {
                    github_id: id,
                    login,
                    name,
                    avatar_url
                }
            })
        }
        
        // Retornar o token com as infos do usuário 
        const token = sign(
            {
                user: {
                    name: user.name,
                    avatar_url: user.avatar_url,
                    id: user.id
                }
            },
            process.env.JWT_SECRET,
            {
                subject: user.id,
                expiresIn: "1d"
            }
        )

        return { token, user };
    }
}

export { AuthUserService }
