# script to fill de globals.js for public js files to consume

cat ./.env | while read -r line
    do
        VAR_NAME=$(echo $line | cut -d "=" -f 1)
        VAR_VALUE=$(echo $line | cut -d "=" -f 2)

        if [ "$VAR_NAME" = "AUTOZAP_SOCKET_URL" ]; then
            scrpt='const globals = {\n\tSOCKET_URL: "'$VAR_VALUE'"\n}\n\nexport default globals'

            # CREATE FILE
            FILE_URL=./public/js/globals.js
            touch $FILE_URL

            # FILL IT
            echo -e $scrpt > $FILE_URL
        fi
    done < ./.env